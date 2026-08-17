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
const send = () => POST(req({ guestIds: [GUEST_ID], template: 'rsvp_reminder' }))
type Result = { success: boolean; error?: string }
const results = (res: unknown) => (res as { body: { results: Result[] } }).body.results
const sentText = () => (sendEmail as jest.Mock).mock.calls[0][0].text

// A guest with no answer yet — the only kind this note is for.
const unanswered = { id: GUEST_ID, firstName: 'Marilyn', lastName: 'Foster', email: 'm@x.com', attending: null, rsvpdCount: null, reservedSeats: 1 }

const withDeadline = (rsvpDeadline: string) =>
  (prisma.setting.findUnique as jest.Mock).mockResolvedValue({ value: JSON.stringify({ rsvpDeadline }) })

beforeEach(() => {
  jest.clearAllMocks()
  // The clock is pinned so the day count is deterministic, but timers still tick:
  // the send route throttles 600ms between recipients, and frozen timers would
  // hang that loop forever rather than testing it.
  jest.useFakeTimers({ advanceTimers: true }).setSystemTime(new Date('2026-08-17T14:00:00-06:00'))
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
  ;(prisma.guest.findMany as jest.Mock).mockResolvedValue([unanswered])
  withDeadline('2026-08-20')
})

afterEach(() => jest.useRealTimers())

it('sends the reminder with the days worked out from the deadline', async () => {
  const res = await send()
  expect(results(res)[0].success).toBe(true)
  expect(sentText()).toContain('you have 3 days to reply')
})

it('names the deadline date as well as the count', async () => {
  await send()
  expect(sentText()).toContain('Thursday, August 20, 2026')
})

it('takes the deadline from the saved setting, so it can move without a deploy', async () => {
  withDeadline('2026-08-25')
  await send()
  expect(sentText()).toContain('you have 8 days to reply')
})

it('falls back to the date Nicolle gave when nothing is saved', async () => {
  ;(prisma.setting.findUnique as jest.Mock).mockResolvedValue(null)
  await send()
  expect(sentText()).toContain('August 20, 2026')
})

it('says today is the last day on the deadline itself', async () => {
  withDeadline('2026-08-17')
  await send()
  expect(sentText()).toContain('today is the last day')
})

describe('the guards that stop a nonsense note going out', () => {
  // "You have -2 days to reply" is not a note you send a hundred people.
  it('refuses once the deadline has passed', async () => {
    withDeadline('2026-08-10')
    const res = await send()
    expect(results(res)[0].success).toBe(false)
    expect(results(res)[0].error).toMatch(/deadline has passed/i)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('refuses when the saved deadline is not a real date', async () => {
    withDeadline('next Thursday')
    const res = await send()
    expect(results(res)[0].success).toBe(false)
    expect(results(res)[0].error).toMatch(/valid date/i)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  // This is the "RSVP - unknown" note. Someone who already said yes would read
  // "reply before you're listed as no" as us having lost their RSVP.
  it('refuses for a guest who has already accepted', async () => {
    ;(prisma.guest.findMany as jest.Mock).mockResolvedValue([{ ...unanswered, attending: true }])
    const res = await send()
    expect(results(res)[0].success).toBe(false)
    expect(results(res)[0].error).toMatch(/already replied/i)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('refuses for a guest who has already declined', async () => {
    ;(prisma.guest.findMany as jest.Mock).mockResolvedValue([{ ...unanswered, attending: false }])
    const res = await send()
    expect(results(res)[0].success).toBe(false)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('still skips a guest with no email on file', async () => {
    ;(prisma.guest.findMany as jest.Mock).mockResolvedValue([{ ...unanswered, email: null }])
    const res = await send()
    expect(results(res)[0].error).toMatch(/No email on file/i)
  })
})

it('logs the send under its own type, so it can be tracked like the others', async () => {
  const { logEmail } = jest.requireMock('@/lib/email')
  await send()
  expect((logEmail as jest.Mock).mock.calls[0][0].emailType).toBe('gated_rsvp_reminder')
})

// Every note in one batch must quote the same number, not drift across a send that
// straddles midnight.
it('quotes the same day count for everyone in one send', async () => {
  const second = { ...unanswered, id: '22222222-2222-4222-8222-222222222222', email: 'b@x.com' }
  ;(prisma.guest.findMany as jest.Mock).mockResolvedValue([unanswered, second])
  await POST(req({ guestIds: [GUEST_ID, second.id], template: 'rsvp_reminder' }))
  const texts = (sendEmail as jest.Mock).mock.calls.map((c) => c[0].text)
  expect(texts).toHaveLength(2)
  expect(texts[0]).toContain('3 days')
  expect(texts[1]).toContain('3 days')
})
