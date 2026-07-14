/**
 * Route-level tests for POST /api/admin/guests and PUT /api/admin/guests/[id]:
 * auth guard, the reserved-seats cap rejection (400), and the happy path.
 */
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: { guest: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() } },
}))

import { POST } from '../route'
import { PUT } from '../[id]/route'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

const mockSession = getServerSession as jest.Mock
const mockPrisma = prisma as jest.Mocked<any>

const req = (body: unknown) => ({ json: async () => body }) as any

beforeEach(() => {
  jest.clearAllMocks()
  mockSession.mockResolvedValue({ user: { role: 'admin' } })
})

describe('POST /api/admin/guests', () => {
  it('returns 401 when not admin', async () => {
    mockSession.mockResolvedValue(null)
    const res: any = await POST(req({ firstName: 'A', lastName: 'B', email: 'a@b.c' }))
    expect(res.status).toBe(401)
  })

  it('rejects with 400 when rsvpd count exceeds reserved seats', async () => {
    const res: any = await POST(req({
      firstName: 'Callie', lastName: 'Clark', email: 'callie@x.com',
      reservedSeats: 7, rsvpdCount: 9,
    }))
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/exceeds reserved seats/)
    expect(mockPrisma.guest.create).not.toHaveBeenCalled()
  })

  it('creates a guest on the happy path', async () => {
    mockPrisma.guest.findUnique.mockResolvedValue(null)
    mockPrisma.guest.create.mockResolvedValue({ id: 'g1', firstName: 'Amethyst' })
    const res: any = await POST(req({
      firstName: 'Amethyst', lastName: 'Johannes', email: 'a@x.com',
      reservedSeats: 4, rsvpdCount: 2,
    }))
    expect(res.status).toBe(200)
    expect(mockPrisma.guest.create).toHaveBeenCalled()
  })
})

describe('PUT /api/admin/guests/[id]', () => {
  const params = Promise.resolve({ id: 'g1' })

  it('returns 401 when not admin', async () => {
    mockSession.mockResolvedValue(null)
    const res: any = await PUT(req({ firstName: 'A', lastName: 'B', email: 'a@b.c' }), { params })
    expect(res.status).toBe(401)
  })

  it('rejects with 400 when rsvpd count exceeds reserved seats', async () => {
    mockPrisma.guest.findFirst.mockResolvedValue(null) // email not taken by another
    const res: any = await PUT(req({
      firstName: 'Callie', lastName: 'Clark', email: 'callie@x.com',
      reservedSeats: 7, rsvpdCount: 9,
    }), { params })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/exceeds reserved seats/)
    expect(mockPrisma.guest.update).not.toHaveBeenCalled()
  })

  it('fully resets the RSVP when attending is set to No Response (null)', async () => {
    mockPrisma.guest.findFirst.mockResolvedValue(null)
    mockPrisma.guest.update.mockResolvedValue({ id: 'g1' })
    const res: any = await PUT(req({
      firstName: 'Whit', lastName: 'Walters', email: 'whit@x.com',
      attending: null, rsvpdCount: 3, reservedSeats: 2,
    }), { params })
    expect(res.status).toBe(200) // count is wiped, so no seat-cap rejection
    const data = mockPrisma.guest.update.mock.calls[0][0].data
    expect(data.attending).toBeNull()
    expect(data.rsvpReceivedAt).toBeNull()
    expect(data.rsvpdCount).toBeNull()
    expect(data.partySize).toBeNull()
  })

  it('does not wipe rsvpReceivedAt on a normal attending edit', async () => {
    mockPrisma.guest.findFirst.mockResolvedValue(null)
    mockPrisma.guest.update.mockResolvedValue({ id: 'g1' })
    await PUT(req({
      firstName: 'Whit', lastName: 'Walters', email: 'whit@x.com',
      attending: true, rsvpdCount: 3, reservedSeats: 4,
    }), { params })
    const data = mockPrisma.guest.update.mock.calls[0][0].data
    expect(data.attending).toBe(true)
    expect(data.rsvpdCount).toBe(3)
    expect(data.rsvpReceivedAt).toBeUndefined() // left untouched, existing value persists
  })
})
