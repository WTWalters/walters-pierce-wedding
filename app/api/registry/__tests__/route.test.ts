jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('@/lib/prisma', () => ({ prisma: { registryItem: { findMany: jest.fn() } } }))

import { GET } from '../route'
import { prisma } from '@/lib/prisma'
const mockPrisma = prisma as jest.Mocked<any>

it('returns active tiers with numeric amounts, sorted', async () => {
  mockPrisma.registryItem.findMany.mockResolvedValue([
    { id: 'a', title: 'Buy us Coffee', description: 'x', imageUrl: null, targetAmount: 25, amountRaised: 0, category: 'dining', sortOrder: 1 },
  ])
  const res: any = await GET()
  expect(mockPrisma.registryItem.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })
  )
  expect(res.body.items[0]).toMatchObject({ title: 'Buy us Coffee', targetAmount: 25, amountRaised: 0 })
  expect(typeof res.body.items[0].targetAmount).toBe('number')
})
