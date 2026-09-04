jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contribution: { findMany: jest.fn() },
    registryItem: { findMany: jest.fn() },
    // The route resolves each gift to a guest and feeds the form's guest picker.
    guest: { findMany: jest.fn() },
  },
}))

import { GET } from '../route'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
const mockSession = getServerSession as jest.Mock
const mockPrisma = prisma as jest.Mocked<any>

beforeEach(() => {
  jest.clearAllMocks()
  mockSession.mockResolvedValue({ user: { role: 'admin' } })
  mockPrisma.guest.findMany.mockResolvedValue([])
})

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

// Nicolle needs to SEE which guest a gift is credited to before she sends the note,
// rather than discovering at send time that the gift can't be found.
describe('the guest each gift is credited to', () => {
  const marilyn = {
    id: 'g-marilyn', firstName: 'Marilyn', lastName: 'Foster', email: null,
    partnerFirstName: null, partnerLastName: null, partnerEmail: null,
  }
  const givenBy = (gift: Record<string, unknown>) => {
    mockPrisma.registryItem.findMany.mockResolvedValue([])
    mockPrisma.guest.findMany.mockResolvedValue([marilyn])
    mockPrisma.contribution.findMany.mockResolvedValue([
      { id: 'c1', amount: 0, message: null, paymentStatus: null, thankYouSent: false, createdAt: new Date('2026-09-01'), registryItem: null, ...gift },
    ])
  }

  it('resolves a hand-recorded gift with no email, by name', async () => {
    givenBy({ contributorName: 'Aunt Marilyn', contributorEmail: '', guestId: null })
    const res: any = await GET({} as any)
    expect(res.body.contributions[0]).toMatchObject({
      matchedGuestId: 'g-marilyn', matchedGuestName: 'Marilyn Foster', matchedBy: 'name',
    })
  })

  it('reports an explicit link as such', async () => {
    givenBy({ contributorName: 'Somebody Else', contributorEmail: '', guestId: 'g-marilyn' })
    const res: any = await GET({} as any)
    expect(res.body.contributions[0]).toMatchObject({ matchedGuestId: 'g-marilyn', matchedBy: 'linked' })
  })

  it('flags a gift that matches nobody, so she can link it herself', async () => {
    givenBy({ contributorName: 'A Total Stranger', contributorEmail: '', guestId: null })
    const res: any = await GET({} as any)
    expect(res.body.contributions[0]).toMatchObject({ matchedGuestId: null, matchedGuestName: null, matchedBy: null })
  })

  it('offers the guest list for the form picker', async () => {
    givenBy({ contributorName: 'Aunt Marilyn', contributorEmail: '', guestId: null })
    const res: any = await GET({} as any)
    expect(res.body.guests).toEqual([{ id: 'g-marilyn', name: 'Marilyn Foster', email: null }])
  })
})
