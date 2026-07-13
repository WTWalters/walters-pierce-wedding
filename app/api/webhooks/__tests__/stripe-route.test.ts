jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
const mockConstructEvent = jest.fn()
jest.mock('@/lib/stripe', () => ({ getStripe: () => ({ webhooks: { constructEvent: mockConstructEvent } }) }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contribution: { findUnique: jest.fn(), create: jest.fn() },
    registryItem: { update: jest.fn(), findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'm1' }),
  logEmail: jest.fn(),
  EMME_CONNOR_FROM: 'Emme & Connor <x@y.z>',
}))
jest.mock('@/lib/email-templates', () => ({
  generateRegistryThankYouEmail: () => ({ subject: 's', html: 'h', text: 't' }),
}))

import { POST } from '../stripe/route'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
const mockPrisma = prisma as jest.Mocked<any>

const OLD_ENV = process.env
beforeEach(() => {
  jest.clearAllMocks()
  process.env = { ...OLD_ENV, STRIPE_WEBHOOK_SECRET: 'whsec_test' }
  mockPrisma.registryItem.findUnique.mockResolvedValue({ id: 'a', title: 'Buy us Dinner' })
})
afterAll(() => { process.env = OLD_ENV })

const req = (raw = '{}') => ({ text: async () => raw, headers: { get: () => 'sig' } }) as any

const completedEvent = {
  type: 'checkout.session.completed',
  data: { object: {
    payment_intent: 'pi_1', amount_total: 10000,
    customer_details: { email: 'sue@example.com' },
    metadata: { registryItemId: 'a', contributorName: 'Aunt Sue', contributorMessage: 'Enjoy!' },
  } },
}

it('rejects an invalid signature (400)', async () => {
  mockConstructEvent.mockImplementation(() => { throw new Error('bad sig') })
  const res: any = await POST(req())
  expect(res.status).toBe(400)
})

it('records the contribution, bumps the tier, and sends the receipt', async () => {
  mockConstructEvent.mockReturnValue(completedEvent)
  mockPrisma.contribution.findUnique.mockResolvedValue(null)
  mockPrisma.contribution.create.mockResolvedValue({ id: 'c1' })
  mockPrisma.registryItem.update.mockResolvedValue({})

  const res: any = await POST(req())

  expect(res.status).toBe(200)
  const created = mockPrisma.contribution.create.mock.calls[0][0].data
  expect(created).toMatchObject({
    registryItemId: 'a', contributorName: 'Aunt Sue', contributorEmail: 'sue@example.com',
    stripePaymentIntentId: 'pi_1', paymentStatus: 'paid', thankYouSent: true,
  })
  expect(Number(created.amount)).toBe(100)
  expect(mockPrisma.registryItem.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 'a' }, data: { amountRaised: { increment: 100 } } })
  )
  expect(sendEmail).toHaveBeenCalled()
})

it('is idempotent on a duplicate event (no second row)', async () => {
  mockConstructEvent.mockReturnValue(completedEvent)
  mockPrisma.contribution.findUnique.mockResolvedValue({ id: 'c1' }) // already recorded
  const res: any = await POST(req())
  expect(res.status).toBe(200)
  expect(mockPrisma.contribution.create).not.toHaveBeenCalled()
  expect(mockPrisma.registryItem.update).not.toHaveBeenCalled()
})
