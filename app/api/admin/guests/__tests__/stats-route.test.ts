jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: { guest: { count: jest.fn(), aggregate: jest.fn(), findMany: jest.fn() } },
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

it('attending tallies headcount; rsvpReceived counts responding parties', async () => {
  mockPrisma.guest.aggregate.mockResolvedValue({ _sum: { reservedSeats: 117 } })
  // 3 attending parties: rsvpdCount 3, legacy partySize 2, and one with neither (counts as 1)
  mockPrisma.guest.findMany.mockResolvedValue([
    { rsvpdCount: 3, partySize: null },
    { rsvpdCount: null, partySize: 2 },
    { rsvpdCount: null, partySize: null },
  ])
  mockPrisma.guest.count.mockResolvedValue(2) // notAttending parties

  const res: any = await GET({} as any)

  expect(res.body.totalInvited).toBe(117)
  expect(res.body.attending).toBe(6) // 3 + 2 + 1 people, not 3 parties
  expect(res.body.notAttending).toBe(2)
  expect(res.body.rsvpReceived).toBe(5) // 3 attending parties + 2 declining
  expect(res.body).not.toHaveProperty('plusOnes')
  expect(res.body).not.toHaveProperty('invited')
})

it('returns 401 when not admin', async () => {
  mockSession.mockResolvedValue(null)
  const res: any = await GET({} as any)
  expect(res.status).toBe(401)
})
