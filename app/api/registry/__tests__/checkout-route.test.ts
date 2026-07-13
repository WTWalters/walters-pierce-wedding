jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('@/lib/prisma', () => ({ prisma: { registryItem: { findFirst: jest.fn() } } }))
const mockCreate = jest.fn()
jest.mock('@/lib/stripe', () => ({ getStripe: () => ({ checkout: { sessions: { create: mockCreate } } }) }))

import { POST } from '../checkout/route'
import { prisma } from '@/lib/prisma'
const mockPrisma = prisma as jest.Mocked<any>

const req = (body: unknown) => ({ json: async () => body, url: 'https://walters-pierce-wedding.com/api/registry/checkout' }) as any

beforeEach(() => { jest.clearAllMocks(); mockCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/abc' }) })

it('creates a session for a fixed tier with the right amount + metadata', async () => {
  mockPrisma.registryItem.findFirst.mockResolvedValue({ id: 'a', title: 'Buy us Dinner', category: 'dining', targetAmount: 100, isActive: true })
  const res: any = await POST(req({ registryItemId: 'a', name: 'Aunt Sue', message: 'Enjoy!' }))
  expect(res.body.url).toContain('checkout.stripe.com')
  const arg = mockCreate.mock.calls[0][0]
  expect(arg.line_items[0].price_data.unit_amount).toBe(10000)
  expect(arg.line_items[0].price_data.product_data.name).toBe('Buy us Dinner')
  expect(arg.metadata).toMatchObject({ registryItemId: 'a', contributorName: 'Aunt Sue', contributorMessage: 'Enjoy!' })
})

it('rejects the variable Flight with no amount (400)', async () => {
  mockPrisma.registryItem.findFirst.mockResolvedValue({ id: 'f', title: 'Flight', category: 'flights', targetAmount: 2000, isActive: true })
  const res: any = await POST(req({ registryItemId: 'f', name: 'Sue' }))
  expect(res.status).toBe(400)
  expect(mockCreate).not.toHaveBeenCalled()
})

it('404s for an unknown/inactive item', async () => {
  mockPrisma.registryItem.findFirst.mockResolvedValue(null)
  const res: any = await POST(req({ registryItemId: 'nope', name: 'Sue' }))
  expect(res.status).toBe(404)
})

it('400s on missing name', async () => {
  const res: any = await POST(req({ registryItemId: 'a' }))
  expect(res.status).toBe(400)
})
