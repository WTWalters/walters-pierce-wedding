jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: { contribution: { findMany: jest.fn() }, registryItem: { findMany: jest.fn() } },
}))

import { GET } from '../route'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
const mockSession = getServerSession as jest.Mock
const mockPrisma = prisma as jest.Mocked<any>

beforeEach(() => { jest.clearAllMocks(); mockSession.mockResolvedValue({ user: { role: 'admin' } }) })

it('401 when not admin', async () => {
  mockSession.mockResolvedValue(null)
  const res: any = await GET({} as any)
  expect(res.status).toBe(401)
})

it('returns contributions + per-tier totals', async () => {
  mockPrisma.registryItem.findMany.mockResolvedValue([
    { id: 'a', title: 'Buy us Dinner', targetAmount: 100, amountRaised: 200, sortOrder: 1, category: 'dining', isActive: true },
  ])
  mockPrisma.contribution.findMany.mockResolvedValue([
    { id: 'c1', contributorName: 'Sue', contributorEmail: 's@x.com', amount: 100, message: 'Yay', paymentStatus: 'paid', thankYouSent: true, createdAt: new Date('2026-09-01'), registryItem: { title: 'Buy us Dinner' } },
  ])
  const res: any = await GET({} as any)
  expect(res.body.contributions[0]).toMatchObject({ contributorName: 'Sue', tierTitle: 'Buy us Dinner', amount: 100 })
  expect(res.body.tiers[0]).toMatchObject({ title: 'Buy us Dinner', amountRaised: 200 })
})
