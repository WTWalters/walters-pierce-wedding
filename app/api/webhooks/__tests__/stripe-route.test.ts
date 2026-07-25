jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
const mockConstructEvent = jest.fn()
jest.mock('@/lib/stripe', () => ({ getStripe: () => ({ webhooks: { constructEvent: mockConstructEvent } }) }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contribution: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    registryItem: { update: jest.fn(), findUnique: jest.fn() },
    guest: { findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'm1' }),
  logEmail: jest.fn(),
  EMME_CONNOR_FROM: 'Emme & Connor <x@y.z>',
  NOTIFY_EMAIL: 'notify@test',
  GIFT_NOTIFY_EMAILS: ['notify@test', 'emme@test'],
}))
jest.mock('@/lib/email-templates', () => ({
  generateRegistryThankYouEmail: ({ name }: { name: string }) =>
    ({ subject: `thanks ${name}`, html: 'h', text: 't' }),
  generateGiftNotificationEmail: ({ name }: { name: string }) =>
    ({ subject: `gift ${name}`, html: 'gh', text: 'gt' }),
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
  mockPrisma.guest.findUnique.mockResolvedValue(null)
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
  mockPrisma.contribution.update.mockResolvedValue({})
  mockPrisma.registryItem.update.mockResolvedValue({})

  const res: any = await POST(req())

  expect(res.status).toBe(200)
  const created = mockPrisma.contribution.create.mock.calls[0][0].data
  expect(created).toMatchObject({
    registryItemId: 'a', contributorName: 'Aunt Sue', contributorEmail: 'sue@example.com',
    stripePaymentIntentId: 'pi_1', paymentStatus: 'paid',
  })
  expect(Number(created.amount)).toBe(100)
  expect(mockPrisma.registryItem.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 'a' }, data: { amountRaised: { increment: 100 } } })
  )
  // receipt sent successfully → thank-you flag is only set afterward
  expect(mockPrisma.contribution.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 'c1' }, data: expect.objectContaining({ thankYouSent: true }) })
  )
  expect(sendEmail).toHaveBeenCalled()
  // the coordinator + couple get the gift heads-up (in addition to the giver's receipt)
  expect(sendEmail).toHaveBeenCalledWith(
    expect.objectContaining({ to: ['notify@test', 'emme@test'] }), expect.anything()
  )
})

it('is idempotent on a duplicate event (no second row)', async () => {
  mockConstructEvent.mockReturnValue(completedEvent)
  mockPrisma.contribution.findUnique.mockResolvedValue({ id: 'c1' }) // already recorded
  const res: any = await POST(req())
  expect(res.status).toBe(200)
  expect(mockPrisma.contribution.create).not.toHaveBeenCalled()
  expect(mockPrisma.registryItem.update).not.toHaveBeenCalled()
})

it('greets an unmatched giver with their shortened typed name', async () => {
  mockConstructEvent.mockReturnValue(completedEvent)
  mockPrisma.contribution.findUnique.mockResolvedValue(null)
  mockPrisma.contribution.create.mockResolvedValue({ id: 'c1' })
  mockPrisma.contribution.update.mockResolvedValue({})
  mockPrisma.registryItem.update.mockResolvedValue({})

  await POST(req())

  // "Aunt Sue" -> first word of the single name part
  const thankYou = (sendEmail as jest.Mock).mock.calls.find((c) => c[0].subject?.startsWith('thanks'))
  expect(thankYou[0].subject).toBe('thanks Aunt')
  // the coordinator heads-up keeps the REAL typed name
  const notif = (sendEmail as jest.Mock).mock.calls.find((c) => c[0].subject?.startsWith('gift'))
  expect(notif[0].subject).toBe('gift Aunt Sue')
})

it('greets a matched guest with their preferred name', async () => {
  mockConstructEvent.mockReturnValue(completedEvent)
  mockPrisma.contribution.findUnique.mockResolvedValue(null)
  mockPrisma.contribution.create.mockResolvedValue({ id: 'c1' })
  mockPrisma.contribution.update.mockResolvedValue({})
  mockPrisma.registryItem.update.mockResolvedValue({})
  mockPrisma.guest.findUnique.mockResolvedValue({ firstName: 'Muriel', preferredName: 'Grandma' })

  await POST(req())

  expect(mockPrisma.guest.findUnique).toHaveBeenCalledWith({ where: { email: 'sue@example.com' } })
  const thankYou = (sendEmail as jest.Mock).mock.calls.find((c) => c[0].subject?.startsWith('thanks'))
  expect(thankYou[0].subject).toBe('thanks Grandma')
})
