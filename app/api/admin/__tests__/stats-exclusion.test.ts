jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { guest: { findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn() } } }))

import { getServerSession } from 'next-auth'
import { GET as guestStats } from '../guests/stats/route'
import { GET as dashStats } from '../stats/route'
import { prisma } from '@/lib/prisma'

const req = () => ({ url: 'http://x' }) as never
const EXCLUDE = { NOT: { source: 'self_rsvp', reviewedAt: null } }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
  ;(prisma.guest.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.guest.count as jest.Mock).mockResolvedValue(0)
  ;(prisma.guest.aggregate as jest.Mock).mockResolvedValue({ _sum: { reservedSeats: 0 } })
})

it('guests/stats excludes awaiting-review from attending and notAttending', async () => {
  await guestStats(req())
  expect(prisma.guest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { attending: true, ...EXCLUDE } }))
  expect(prisma.guest.count).toHaveBeenCalledWith({ where: { attending: false, ...EXCLUDE } })
  expect(prisma.guest.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: EXCLUDE }))
})

it('dashboard stats excludes awaiting-review from all counts', async () => {
  await dashStats(req())
  const calls = (prisma.guest.count as jest.Mock).mock.calls.map((c) => c[0])
  expect(calls).toContainEqual({ where: EXCLUDE })
  expect(calls).toContainEqual({ where: { attending: true, ...EXCLUDE } })
  expect(calls).toContainEqual({ where: { attending: false, ...EXCLUDE } })
  expect(calls).toContainEqual({ where: { attending: { not: null }, ...EXCLUDE } })
})

it('guests/stats 401s non-admin', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'guest' } })
  const res = (await guestStats(req())) as { status: number }
  expect(res.status).toBe(401)
})
