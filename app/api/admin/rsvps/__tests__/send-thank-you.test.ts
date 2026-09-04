jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: {
  guest: { findMany: jest.fn() },
  setting: { findUnique: jest.fn() },
  contribution: { findMany: jest.fn(), updateMany: jest.fn() },
} }))
jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'm1' }),
  logEmail: jest.fn().mockResolvedValue(undefined),
  COORDINATOR_FROM: 'Coordinator <c@x.com>',
  NOTIFY_EMAIL: 'n@x.com',
}))

import { getServerSession } from 'next-auth'
import { POST } from '../send/route'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

const req = (body: unknown) => ({ json: async () => body }) as never
const GUEST_ID = '11111111-1111-4111-8111-111111111111'
const send = () => POST(req({ guestIds: [GUEST_ID], template: 'registry_thank_you' }))
type Result = { success: boolean; error?: string }
const results = (res: unknown) => (res as { body: { results: Result[] } }).body.results

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
  ;(prisma.setting.findUnique as jest.Mock).mockResolvedValue({ value: '{}' })
  ;(prisma.guest.findMany as jest.Mock).mockResolvedValue([
    { id: GUEST_ID, firstName: 'Muriel', lastName: 'Ashby', preferredName: 'Grandma', email: 'Muriel@X.com', rsvpdCount: 1, reservedSeats: 1 },
  ])
  ;(prisma.contribution.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
})

// The route loads every gift and resolves each to a guest (lib/gift-match), so a
// fixture is a list and each gift needs something to be matched ON. These helpers
// default that to the guest's own address; tests about matching set it themselves.
const withIdentity = (gift: Record<string, unknown>) => ({
  contributorName: 'Muriel Ashby',
  contributorEmail: 'muriel@x.com',
  ...gift,
})
const giftOnFile = (gift: Record<string, unknown> | null) =>
  (prisma.contribution.findMany as jest.Mock).mockResolvedValue(gift ? [withIdentity(gift)] : [])
const giftsOnFile = (gifts: Array<Record<string, unknown>>) =>
  (prisma.contribution.findMany as jest.Mock).mockResolvedValue(gifts.map(withIdentity))

it('thanks them for the gift on record', async () => {
  giftOnFile({ id: 'gift1', amount: 150, giftDescription: 'cheque', registryItem: null })
  const res = await send()
  expect(results(res)[0].success).toBe(true)
  const sent = (sendEmail as jest.Mock).mock.calls[0][0]
  expect(sent.text).toContain('generous gift of $150 toward cheque')
})

// The preferred-name override applies here like every other gated email.
it('greets them by their preferred name', async () => {
  giftOnFile({ id: 'gift1', amount: 150, giftDescription: 'cheque', registryItem: null })
  await send()
  expect((sendEmail as jest.Mock).mock.calls[0][0].text).toContain('Dear Grandma')
})

it('prefers the tier title for a Honeymoon Fund gift', async () => {
  giftOnFile({ id: 'gift1', amount: 50, giftDescription: null, registryItem: { title: 'Buy us Coffee' } })
  await send()
  expect((sendEmail as jest.Mock).mock.calls[0][0].text).toContain('toward Buy us Coffee')
})

// Only the RSVP intake lowercases addresses; admin-entered guests keep their casing,
// so a case-sensitive lookup would miss exactly the hand-entered records.
it('finds the gift regardless of email casing', async () => {
  giftOnFile({
    id: 'gift1', amount: 20, giftDescription: 'cash', registryItem: null,
    contributorEmail: 'MURIEL@x.COM', // guest is on file as Muriel@X.com
  })
  const res = await send()
  expect(results(res)[0].success).toBe(true)
})

// The disconnect Nicolle reported: she records a cash gift or a present by hand and
// has no email for the giver, so an email-only lookup insisted no gift existed.
it('finds a hand-recorded gift that has no email on it, by name', async () => {
  giftOnFile({
    id: 'gift1', amount: 0, giftDescription: 'beautiful cake serving set', registryItem: null,
    contributorName: 'Aunt Muriel', contributorEmail: '',
  })
  const res = await send()
  expect(results(res)[0].success).toBe(true)
  expect((sendEmail as jest.Mock).mock.calls[0][0].text).toContain('beautiful cake serving set')
})

// The other half of it: a Stripe gift carries whatever address was typed at
// checkout, which needn't be the one on the guest record.
it('finds a gift given under a different email, by name', async () => {
  giftOnFile({
    id: 'gift1', amount: 25, giftDescription: null, registryItem: { title: 'Buy Me a Coffee' },
    contributorName: 'Muriel Ashby', contributorEmail: 'someone-else@work.example',
  })
  const res = await send()
  expect(results(res)[0].success).toBe(true)
  expect((sendEmail as jest.Mock).mock.calls[0][0].text).toContain('Buy Me a Coffee')
})

// The explicit link Nicolle sets on the gift form beats any guesswork.
it('uses the guest picked on the gift form even when the name says otherwise', async () => {
  giftOnFile({
    id: 'gift1', amount: 40, giftDescription: 'cash', registryItem: null,
    guestId: GUEST_ID, contributorName: 'Somebody Else Entirely', contributorEmail: '',
  })
  const res = await send()
  expect(results(res)[0].success).toBe(true)
})

// A gift that could be either of two guests must not be sent to the wrong one.
it('refuses rather than guess between two guests with the same first name', async () => {
  ;(prisma.guest.findMany as jest.Mock).mockResolvedValue([
    { id: GUEST_ID, firstName: 'Muriel', lastName: 'Ashby', email: 'Muriel@X.com', rsvpdCount: 1, reservedSeats: 1 },
    { id: '22222222-2222-4222-8222-222222222222', firstName: 'Muriel', lastName: 'Boyd', email: 'mb@x.com', rsvpdCount: 1, reservedSeats: 1 },
  ])
  giftOnFile({
    id: 'gift1', amount: 0, giftDescription: 'a vase', registryItem: null,
    contributorName: 'Aunt Muriel', contributorEmail: '',
  })
  const res = await send()
  expect(results(res)[0].success).toBe(false)
  expect(results(res)[0].error).toMatch(/No gift on file/)
})

it('loads gifts oldest-first so the sentence reads in order', async () => {
  giftOnFile({ id: 'gift1', amount: 20, giftDescription: 'cash', registryItem: null })
  await send()
  expect((prisma.contribution.findMany as jest.Mock).mock.calls[0][0].orderBy).toEqual({ createdAt: 'asc' })
})

// Aunt Marilyn's case: a cake serving set plus cash, recorded separately.
describe('several gifts from one person', () => {
  const marilyn = () =>
    giftsOnFile([
      { id: 'gift1', amount: 0, giftDescription: 'beautiful cake serving set', registryItem: null },
      { id: 'gift2', amount: 100, giftDescription: 'our AirBNB', registryItem: null },
    ])

  it('acknowledges all of them in one note', async () => {
    marilyn()
    await send()
    const sent = (sendEmail as jest.Mock).mock.calls[0][0]
    expect(sent.text).toContain('beautiful cake serving set, as well as $100 toward our AirBNB')
  })

  it('sends only one email', async () => {
    marilyn()
    await send()
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  // Otherwise the Gifts tab would show a thanked serving set beside an unthanked
  // cheque that the same note already covered.
  it('marks every gift thanked, not just one', async () => {
    marilyn()
    await send()
    expect(prisma.contribution.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['gift1', 'gift2'] } },
      data: expect.objectContaining({ thankYouSent: true }),
    })
  })
})

describe('when no gift is on record', () => {
  // A thank-you that can't name the gift is worse than no thank-you — and silently
  // sending one would leave her believing it said something it didn't.
  it('refuses and says why', async () => {
    giftOnFile(null)
    const res = await send()
    expect(results(res)[0].success).toBe(false)
    expect(results(res)[0].error).toMatch(/No gift on file/)
  })

  it('sends nothing at all', async () => {
    giftOnFile(null)
    await send()
    expect(sendEmail).not.toHaveBeenCalled()
  })
})

describe('marking the gift thanked', () => {
  it('records it after a successful send', async () => {
    giftOnFile({ id: 'gift1', amount: 150, giftDescription: 'cheque', registryItem: null })
    await send()
    expect(prisma.contribution.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['gift1'] } },
      data: expect.objectContaining({ thankYouSent: true }),
    })
  })

  it('does not record it when the send failed', async () => {
    giftOnFile({ id: 'gift1', amount: 150, giftDescription: 'cheque', registryItem: null })
    ;(sendEmail as jest.Mock).mockResolvedValueOnce({ success: false, error: 'resend down' })
    await send()
    expect(prisma.contribution.updateMany).not.toHaveBeenCalled()
  })

  // The note has already gone out; failing the request would misreport that.
  it('still reports success if the bookkeeping write fails', async () => {
    giftOnFile({ id: 'gift1', amount: 150, giftDescription: 'cheque', registryItem: null })
    ;(prisma.contribution.updateMany as jest.Mock).mockRejectedValueOnce(new Error('db blip'))
    const res = await send()
    expect(results(res)[0].success).toBe(true)
  })
})

// The gift lookup must not run for the other templates.
it('does not look up gifts for an RSVP email', async () => {
  await POST(req({ guestIds: [GUEST_ID], template: 'rsvp_no' }))
  expect(prisma.contribution.findMany).not.toHaveBeenCalled()
})
