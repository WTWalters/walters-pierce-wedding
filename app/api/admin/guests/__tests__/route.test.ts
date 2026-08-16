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

// Nicolle: "Number in Party [should] reflect the number of Adults plus the number of
// Children." So the count is derived, never a separate figure to keep in step by
// hand. Adults under 21 are a third bucket, added verbally: an adult meal but
// nothing from the bar, so the two suppliers need different numbers.
describe('the party make-up fields', () => {
  const params = Promise.resolve({ id: 'g1' })
  const created = () => mockPrisma.guest.create.mock.calls[0][0].data
  const updated = () => mockPrisma.guest.update.mock.calls[0][0].data
  const base = { firstName: 'Callie', lastName: 'Clark', email: 'callie@x.com' }

  beforeEach(() => {
    mockPrisma.guest.findUnique.mockResolvedValue(null)
    mockPrisma.guest.findFirst.mockResolvedValue(null)
    mockPrisma.guest.create.mockResolvedValue({ id: 'g1' })
    mockPrisma.guest.update.mockResolvedValue({ id: 'g1' })
  })

  it('stores both on a new guest', async () => {
    await POST(req({ ...base, reservedSeats: '5', adults21Plus: '2', children: '1' }))
    expect(created()).toMatchObject({ adults21Plus: 2, children: 1 })
  })

  it('makes the number in the party their sum, on create', async () => {
    await POST(req({ ...base, reservedSeats: '5', adults21Plus: '2', children: '1' }))
    expect(created().rsvpdCount).toBe(3)
  })

  it('makes the number in the party their sum, on edit', async () => {
    await PUT(req({ ...base, reservedSeats: 5, adults21Plus: '3', children: '2' }), { params })
    expect(updated()).toMatchObject({ adults21Plus: 3, children: 2, rsvpdCount: 5 })
  })

  // A count typed straight into Number RSVP'd must lose to the two fields that
  // define it, or the record could claim 4 people made up of 2 adults and 1 child.
  it('overrides a conflicting count that was typed directly', async () => {
    await PUT(req({ ...base, reservedSeats: 9, rsvpdCount: 4, adults21Plus: '2', children: '1' }), { params })
    expect(updated().rsvpdCount).toBe(3)
  })

  it('treats a blank half as zero once the other is entered', async () => {
    await POST(req({ ...base, reservedSeats: '5', adults21Plus: '2', children: '' }))
    expect(created()).toMatchObject({ adults21Plus: 2, children: null, rsvpdCount: 2 })
  })

  // Every record imported before these fields existed keeps the count it already had.
  it('leaves an existing count alone when neither field is entered', async () => {
    await PUT(req({ ...base, reservedSeats: 5, rsvpdCount: 4 }), { params })
    expect(updated()).toMatchObject({ adults21Plus: null, children: null, rsvpdCount: 4 })
  })

  it('still enforces the seat cap against the derived count', async () => {
    const res: any = await PUT(
      req({ ...base, reservedSeats: 2, adults21Plus: '3', children: '1' }),
      { params }
    )
    expect(res.status).toBe(400)
    expect(mockPrisma.guest.update).not.toHaveBeenCalled()
  })

  // "No Response" has to leave the record looking like no RSVP ever arrived —
  // 2 adults left behind would keep them in the caterer's total.
  it('clears the make-up when the RSVP is reset to No Response', async () => {
    await PUT(
      req({ ...base, attending: null, adults21Plus: '2', adultsUnder21: '1', children: '1' }),
      { params }
    )
    expect(updated()).toMatchObject({
      adults21Plus: null, adultsUnder21: null, children: null, rsvpdCount: null,
    })
  })

  it('stores adults under 21 as their own number', async () => {
    await POST(req({ ...base, reservedSeats: '9', adults21Plus: '2', adultsUnder21: '3', children: '1' }))
    expect(created()).toMatchObject({ adults21Plus: 2, adultsUnder21: 3, children: 1 })
  })

  it('counts adults under 21 into the number in the party', async () => {
    await POST(req({ ...base, reservedSeats: '9', adults21Plus: '2', adultsUnder21: '3', children: '1' }))
    expect(created().rsvpdCount).toBe(6)
  })

  // The bar is quoted off adults21Plus alone, so an under-21 must never land in it.
  it('never folds an under-21 into the drinking-age number', async () => {
    await POST(req({ ...base, reservedSeats: '9', adults21Plus: '2', adultsUnder21: '3' }))
    expect(created().adults21Plus).toBe(2)
  })

  it('derives the count from under-21s alone when they are all there is', async () => {
    await POST(req({ ...base, reservedSeats: '9', adultsUnder21: '3' }))
    expect(created()).toMatchObject({ adults21Plus: null, adultsUnder21: 3, rsvpdCount: 3 })
  })

  it('ignores a nonsense value rather than storing NaN', async () => {
    await POST(req({ ...base, reservedSeats: '5', adults21Plus: 'two', children: '1' }))
    expect(created()).toMatchObject({ adults21Plus: null, children: 1, rsvpdCount: 1 })
  })
})
