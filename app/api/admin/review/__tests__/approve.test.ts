jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { guest: { findFirst: jest.fn(), update: jest.fn() } } }))

import { getServerSession } from 'next-auth'
import { POST } from '../[id]/approve/route'
import { prisma } from '@/lib/prisma'

const ctx = { params: Promise.resolve({ id: 'g1' }) }
const req = () => ({}) as never

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin', email: 'nicolle@x.com' } })
})

it('approves: sets reviewedAt/reviewedBy and backfills reservedSeats from rsvpdCount', async () => {
  ;(prisma.guest.findFirst as jest.Mock).mockResolvedValue({ id: 'g1', reservedSeats: null, rsvpdCount: 3 })
  ;(prisma.guest.update as jest.Mock).mockResolvedValue({})
  const res = (await POST(req(), ctx)) as { status: number; body: Record<string, unknown> }
  expect(res.status).toBe(200)
  const call = (prisma.guest.update as jest.Mock).mock.calls[0][0]
  expect(call.where).toEqual({ id: 'g1' })
  expect(call.data.reviewedAt).toBeInstanceOf(Date)
  expect(call.data.reviewedBy).toBe('nicolle@x.com')
  expect(call.data.reservedSeats).toBe(3)
})

it('does not overwrite an existing reservedSeats', async () => {
  ;(prisma.guest.findFirst as jest.Mock).mockResolvedValue({ id: 'g1', reservedSeats: 2, rsvpdCount: 5 })
  ;(prisma.guest.update as jest.Mock).mockResolvedValue({})
  await POST(req(), ctx)
  expect((prisma.guest.update as jest.Mock).mock.calls[0][0].data.reservedSeats).toBe(2)
})

it('404s if the id is not an awaiting-review submission', async () => {
  ;(prisma.guest.findFirst as jest.Mock).mockResolvedValue(null)
  const res = (await POST(req(), ctx)) as { status: number }
  expect(res.status).toBe(404)
  expect(prisma.guest.update).not.toHaveBeenCalled()
})

it('401s non-admin', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'guest' } })
  const res = (await POST(req(), ctx)) as { status: number }
  expect(res.status).toBe(401)
})
