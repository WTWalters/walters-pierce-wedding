jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: {
  guest: { findMany: jest.fn() },
  setting: { findUnique: jest.fn() },
  contribution: { findFirst: jest.fn(), update: jest.fn() },
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
    { id: GUEST_ID, firstName: 'Muriel', preferredName: 'Grandma', email: 'Muriel@X.com', rsvpdCount: 1, reservedSeats: 1 },
  ])
  ;(prisma.contribution.update as jest.Mock).mockResolvedValue({})
})

const giftOnFile = (gift: Record<string, unknown> | null) =>
  (prisma.contribution.findFirst as jest.Mock).mockResolvedValue(gift)

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
  giftOnFile({ id: 'gift1', amount: 20, giftDescription: 'cash', registryItem: null })
  await send()
  expect((prisma.contribution.findFirst as jest.Mock).mock.calls[0][0].where).toEqual({
    contributorEmail: { equals: 'Muriel@X.com', mode: 'insensitive' },
  })
})

it('takes the most recent gift when there are several', async () => {
  giftOnFile({ id: 'gift1', amount: 20, giftDescription: 'cash', registryItem: null })
  await send()
  expect((prisma.contribution.findFirst as jest.Mock).mock.calls[0][0].orderBy).toEqual({ createdAt: 'desc' })
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
    expect(prisma.contribution.update).toHaveBeenCalledWith({
      where: { id: 'gift1' },
      data: expect.objectContaining({ thankYouSent: true }),
    })
  })

  it('does not record it when the send failed', async () => {
    giftOnFile({ id: 'gift1', amount: 150, giftDescription: 'cheque', registryItem: null })
    ;(sendEmail as jest.Mock).mockResolvedValueOnce({ success: false, error: 'resend down' })
    await send()
    expect(prisma.contribution.update).not.toHaveBeenCalled()
  })

  // The note has already gone out; failing the request would misreport that.
  it('still reports success if the bookkeeping write fails', async () => {
    giftOnFile({ id: 'gift1', amount: 150, giftDescription: 'cheque', registryItem: null })
    ;(prisma.contribution.update as jest.Mock).mockRejectedValueOnce(new Error('db blip'))
    const res = await send()
    expect(results(res)[0].success).toBe(true)
  })
})

// The gift lookup must not run for the other templates.
it('does not look up gifts for an RSVP email', async () => {
  await POST(req({ guestIds: [GUEST_ID], template: 'rsvp_no' }))
  expect(prisma.contribution.findFirst).not.toHaveBeenCalled()
})
