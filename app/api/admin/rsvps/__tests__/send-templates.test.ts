jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: {
  guest: { findMany: jest.fn() },
  setting: { findUnique: jest.fn() },
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
import { sendEmail, logEmail } from '@/lib/email'

const req = (body: unknown) => ({ json: async () => body }) as never

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
  ;(prisma.setting.findUnique as jest.Mock).mockResolvedValue({ value: JSON.stringify({ date:'TBA', time:'TBA', venueName:'Blackstone Rivers Ranch', venueAddress:'3673 Chicago Creek Rd' }) })
  ;(prisma.guest.findMany as jest.Mock).mockResolvedValue([
    { id: '11111111-1111-4111-8111-111111111111', firstName: 'Sam', email: 's@x.com', rsvpdCount: 5, reservedSeats: 4 },
  ])
})

it('accepts rsvp_yes and logs gated_rsvp_yes', async () => {
  const res = (await POST(req({ guestIds: ['11111111-1111-4111-8111-111111111111'], template: 'rsvp_yes' }))) as { status: number }
  expect(res.status).toBe(200)
  expect(sendEmail).toHaveBeenCalled()
  expect((logEmail as jest.Mock).mock.calls[0][0].emailType).toBe('gated_rsvp_yes')
})

it('rsvp_over_count renders with the guest counts', async () => {
  await POST(req({ guestIds: ['11111111-1111-4111-8111-111111111111'], template: 'rsvp_over_count' }))
  const sent = (sendEmail as jest.Mock).mock.calls[0][0]
  expect(sent.html).toContain('included 5 guests')
  expect(sent.html).toContain('the 4 spots')
})

it('skips a guest with no email on file (no send fired for it)', async () => {
  ;(prisma.guest.findMany as jest.Mock).mockResolvedValue([
    { id: '11111111-1111-4111-8111-111111111111', firstName: 'Sam', email: null, rsvpdCount: 5, reservedSeats: 4 },
  ])
  const res = (await POST(req({ guestIds: ['11111111-1111-4111-8111-111111111111'], template: 'rsvp_yes' }))) as { status: number; body: { results: { success: boolean; error?: string }[] } }
  expect(res.status).toBe(200)
  expect(sendEmail).not.toHaveBeenCalled()
  expect(res.body.results[0]).toMatchObject({ success: false, error: 'No email on file' })
})

it('rsvp_yes attaches the .ics when the date parses; rsvp_no attaches nothing', async () => {
  ;(prisma.setting.findUnique as jest.Mock).mockResolvedValue({
    value: JSON.stringify({ date: 'September 20, 2026', time: '4:00 PM', venueName: 'Blackstone Rivers Ranch', venueAddress: '3673 Chicago Creek Rd' }),
  })
  await POST(req({ guestIds: ['11111111-1111-4111-8111-111111111111'], template: 'rsvp_yes' }))
  const yesOpts = (sendEmail as jest.Mock).mock.calls[0][1]
  expect(yesOpts.attachments).toBeDefined()
  expect(yesOpts.attachments[0].filename).toBe('Emme-Connor-Wedding.ics')

  ;(sendEmail as jest.Mock).mockClear()
  await POST(req({ guestIds: ['11111111-1111-4111-8111-111111111111'], template: 'rsvp_no' }))
  const noOpts = (sendEmail as jest.Mock).mock.calls[0][1]
  expect(noOpts.attachments).toBeUndefined()
})

it('rsvp_no sends the acknowledgement', async () => {
  const res = (await POST(req({ guestIds: ['11111111-1111-4111-8111-111111111111'], template: 'rsvp_no' }))) as { status: number }
  expect(res.status).toBe(200)
  expect((logEmail as jest.Mock).mock.calls[0][0].emailType).toBe('gated_rsvp_no')
})

it('rejects an unknown template', async () => {
  const res = (await POST(req({ guestIds: ['11111111-1111-4111-8111-111111111111'], template: 'bogus' }))) as { status: number }
  expect(res.status).toBe(400)
})

it('401s non-admin', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  const res = (await POST(req({ guestIds: ['11111111-1111-4111-8111-111111111111'], template: 'rsvp_yes' }))) as { status: number }
  expect(res.status).toBe(401)
})
