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

// The route issues two findMany calls: attending parties, then declining parties.
const setup = (
  attending: Array<Record<string, unknown>>,
  declining: Array<Record<string, unknown>>,
  reservedTotal = 117
) => {
  mockPrisma.guest.aggregate.mockResolvedValue({ _sum: { reservedSeats: reservedTotal } })
  mockPrisma.guest.findMany
    .mockResolvedValueOnce(attending)
    .mockResolvedValueOnce(declining)
}

it('attending tallies headcount; rsvpReceived counts responding parties', async () => {
  // 3 attending parties: rsvpdCount 3, legacy partySize 2, and one with neither (counts as 1)
  setup(
    [
      { rsvpdCount: 3, partySize: null, reservedSeats: 3 },
      { rsvpdCount: null, partySize: 2, reservedSeats: 2 },
      { rsvpdCount: null, partySize: null, reservedSeats: 1 },
    ],
    [{ reservedSeats: 1 }, { reservedSeats: 1 }]
  )

  const res: any = await GET({} as any)

  expect(res.body.totalInvited).toBe(117)
  expect(res.body.attending).toBe(6) // 3 + 2 + 1 people, not 3 parties
  expect(res.body.notAttending).toBe(2)
  expect(res.body.rsvpReceived).toBe(5) // 3 attending parties + 2 declining
  expect(res.body).not.toHaveProperty('plusOnes')
  expect(res.body).not.toHaveProperty('invited')
})

// Nicolle, 2026-07-29: "Can you add the difference between Spaces Reserved -
// Spaces Claimed (R - C = NA) to the Not Attending summary box".
describe('Not Attending counts people, not parties', () => {
  it("adds an attending party's unclaimed seats", async () => {
    // J Murdock held 2 and brought 1; Nicolle Pratt held 5 and brought 2.
    setup(
      [
        { rsvpdCount: 1, partySize: null, reservedSeats: 2 },
        { rsvpdCount: 2, partySize: null, reservedSeats: 5 },
      ],
      []
    )
    const res: any = await GET({} as any)
    expect(res.body.notAttending).toBe(4) // (2-1) + (5-2)
  })

  it("counts a declining party's whole reservation", async () => {
    setup([], [{ reservedSeats: 4 }, { reservedSeats: 1 }])
    const res: any = await GET({} as any)
    expect(res.body.notAttending).toBe(5)
  })

  // Her live numbers: two decliners at 1 seat each, plus Murdock and Pratt.
  it('matches her example: 2 declined + 1 + 3 = 6', async () => {
    setup(
      [
        { rsvpdCount: 1, partySize: null, reservedSeats: 2 },
        { rsvpdCount: 2, partySize: null, reservedSeats: 5 },
      ],
      [{ reservedSeats: 1 }, { reservedSeats: 1 }]
    )
    const res: any = await GET({} as any)
    expect(res.body.notAttending).toBe(6)
    expect(res.body.rsvpReceived).toBe(4) // still parties: 2 + 2
  })

  it('is zero when every attending party claimed its full reservation', async () => {
    setup([{ rsvpdCount: 4, partySize: null, reservedSeats: 4 }], [])
    const res: any = await GET({} as any)
    expect(res.body.notAttending).toBe(0)
  })

  // An over-cap RSVP must not subtract from the tally.
  it('never goes negative when a party RSVPs for more than it held', async () => {
    setup([{ rsvpdCount: 6, partySize: null, reservedSeats: 4 }], [])
    const res: any = await GET({} as any)
    expect(res.body.notAttending).toBe(0)
  })

  describe('with no reservation recorded', () => {
    // The reservedSeats backfill is still an open item, so nulls are real.
    it('invents no shortfall for an attending party', async () => {
      setup([{ rsvpdCount: 3, partySize: null, reservedSeats: null }], [])
      const res: any = await GET({} as any)
      expect(res.body.notAttending).toBe(0)
    })

    it('still counts one person for a declining party', async () => {
      setup([], [{ reservedSeats: null }])
      const res: any = await GET({} as any)
      expect(res.body.notAttending).toBe(1)
    })
  })

  it('keeps rsvpReceived in parties, not people', async () => {
    setup([{ rsvpdCount: 1, partySize: null, reservedSeats: 5 }], [{ reservedSeats: 3 }])
    const res: any = await GET({} as any)
    expect(res.body.notAttending).toBe(7) // 4 unclaimed + 3 declined
    expect(res.body.rsvpReceived).toBe(2) // two parties answered
  })
})

it('returns 401 when not admin', async () => {
  mockSession.mockResolvedValue(null)
  const res: any = await GET({} as any)
  expect(res.status).toBe(401)
})

// Nicolle needs firm counts for the caterer and the bar, so the two RSVP cards break
// down by group. Adults under 21 are their own bucket: an adult meal, nothing from
// the bar, so neither supplier's number can be read off a combined "adults" figure.
describe('the party make-up breakdown', () => {
  it('splits the attending card', async () => {
    setup(
      [
        { rsvpdCount: 5, partySize: null, reservedSeats: 5, adults21Plus: 2, adultsUnder21: 1, children: 2 },
        { rsvpdCount: 2, partySize: null, reservedSeats: 2, adults21Plus: 2, adultsUnder21: 0, children: 0 },
      ],
      []
    )
    const res: any = await GET({} as any)
    expect(res.body.attending).toBe(7)
    expect(res.body.attendingMix).toEqual({
      adults21Plus: 4, adultsUnder21: 1, children: 2, unspecified: 0,
    })
  })

  // The point of the third bucket: two different supplier numbers, same breakdown.
  it('keeps the bar number separate from the adult-meal number', async () => {
    setup(
      [{ rsvpdCount: 10, partySize: null, reservedSeats: 10, adults21Plus: 6, adultsUnder21: 4, children: 0 }],
      []
    )
    const res: any = await GET({} as any)
    const mix = res.body.attendingMix
    expect(mix.adults21Plus).toBe(6) // the bar
    expect(mix.adults21Plus + mix.adultsUnder21).toBe(10) // adult meals
  })

  it('never counts a party nobody has broken out as adults', async () => {
    setup(
      [
        { rsvpdCount: 2, partySize: null, reservedSeats: 2, adults21Plus: 2, adultsUnder21: 0, children: 0 },
        { rsvpdCount: 3, partySize: null, reservedSeats: 3, adults21Plus: null, adultsUnder21: null, children: null },
      ],
      []
    )
    const res: any = await GET({} as any)
    expect(res.body.attendingMix).toEqual({
      adults21Plus: 2, adultsUnder21: 0, children: 0, unspecified: 3,
    })
  })

  it('always adds up to the number printed on the card', async () => {
    setup(
      [
        { rsvpdCount: 4, partySize: null, reservedSeats: 6, adults21Plus: 1, adultsUnder21: 1, children: 0 },
        { rsvpdCount: 2, partySize: null, reservedSeats: 2, adults21Plus: null, adultsUnder21: null, children: null },
      ],
      [
        { reservedSeats: 3, adults21Plus: 2, adultsUnder21: 1, children: 0 },
        { reservedSeats: 2, adults21Plus: null, adultsUnder21: null, children: null },
      ]
    )
    const res: any = await GET({} as any)
    const sums = (m: Record<string, number>) =>
      m.adults21Plus + m.adultsUnder21 + m.children + m.unspecified
    expect(sums(res.body.attendingMix)).toBe(res.body.attending)
    expect(sums(res.body.notAttendingMix)).toBe(res.body.notAttending)
  })

  it('splits the not-attending card by the declining parties on file', async () => {
    setup([], [{ reservedSeats: 4, adults21Plus: 2, adultsUnder21: 0, children: 2 }])
    const res: any = await GET({} as any)
    expect(res.body.notAttending).toBe(4)
    expect(res.body.notAttendingMix).toEqual({
      adults21Plus: 2, adultsUnder21: 0, children: 2, unspecified: 0,
    })
  })

  // An attending party that held 4 seats and claimed 2 gives up 2 — but nobody ever
  // said who those two would have been, so they can't be called adults.
  it('leaves unclaimed seats unspecified rather than guessing', async () => {
    setup(
      [{ rsvpdCount: 2, partySize: null, reservedSeats: 4, adults21Plus: 2, adultsUnder21: 0, children: 0 }],
      []
    )
    const res: any = await GET({} as any)
    expect(res.body.notAttending).toBe(2)
    expect(res.body.notAttendingMix).toEqual({
      adults21Plus: 0, adultsUnder21: 0, children: 0, unspecified: 2,
    })
  })

  it('reports zeroes when nothing has been broken out at all', async () => {
    setup([{ rsvpdCount: 2, partySize: null, reservedSeats: 2 }], [])
    const res: any = await GET({} as any)
    expect(res.body.attendingMix).toEqual({
      adults21Plus: 0, adultsUnder21: 0, children: 0, unspecified: 2,
    })
  })
})
