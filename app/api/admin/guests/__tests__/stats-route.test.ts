jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: { guest: { count: jest.fn(), aggregate: jest.fn() } },
}))

import { GET } from '../stats/route'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

const mockSession = getServerSession as jest.Mock
const mockPrisma = prisma as jest.Mocked<any>

beforeEach(() => {
  jest.clearAllMocks()
  mockSession.mockResolvedValue({ user: { role: 'admin' } })
})

it('totalInvited is the sum of reservedSeats; rsvpReceived = attending + notAttending', async () => {
  mockPrisma.guest.aggregate.mockResolvedValue({ _sum: { reservedSeats: 117 } })
  // order: attending, notAttending
  mockPrisma.guest.count.mockResolvedValueOnce(7).mockResolvedValueOnce(2)

  const res: any = await GET({} as any)

  expect(res.body.totalInvited).toBe(117)
  expect(res.body.attending).toBe(7)
  expect(res.body.notAttending).toBe(2)
  expect(res.body.rsvpReceived).toBe(9)
  expect(res.body).not.toHaveProperty('plusOnes')
  expect(res.body).not.toHaveProperty('invited')
})

it('returns 401 when not admin', async () => {
  mockSession.mockResolvedValue(null)
  const res: any = await GET({} as any)
  expect(res.status).toBe(401)
})
