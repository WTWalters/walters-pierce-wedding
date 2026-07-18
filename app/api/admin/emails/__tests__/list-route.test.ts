jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { emailLog: { findMany: jest.fn(), count: jest.fn() } } }))

import { getServerSession } from 'next-auth'
import { GET } from '../route'
import { prisma } from '@/lib/prisma'

const req = (url = 'http://x/api/admin/emails') => ({ url }) as never

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
  ;(prisma.emailLog.count as jest.Mock).mockResolvedValue(2)
  ;(prisma.emailLog.findMany as jest.Mock).mockResolvedValue([
    { id: '1', recipientEmail: 'a@x.com', emailType: 'gated_rsvp_yes', subject: 'S', sentAt: new Date('2026-07-18'),
      status: 'delivered', openedAt: null, bouncedAt: null, clickedAt: null,
      guest: { firstName: 'Ann', lastName: 'Lee' } },
    { id: '2', recipientEmail: 'b@x.com', emailType: 'save_the_date', subject: 'T', sentAt: new Date('2026-07-17'),
      status: 'sent', openedAt: null, bouncedAt: null, clickedAt: null, guest: null },
  ])
})

it('401s non-admin', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  const res = (await GET(req())) as { status: number }
  expect(res.status).toBe(401)
})

it('returns rows newest-first with guestName, total, and capped flag', async () => {
  const res = (await GET(req())) as { body: { emails: any[]; total: number; capped: boolean } }
  expect(prisma.emailLog.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ orderBy: { sentAt: 'desc' }, take: 500, where: {} })
  )
  expect(res.body.total).toBe(2)
  expect(res.body.capped).toBe(false)
  expect(res.body.emails[0].guestName).toBe('Ann Lee')
  expect(res.body.emails[1].guestName).toBeNull()
})

it('filters by ?type= (exact emailType)', async () => {
  await GET(req('http://x/api/admin/emails?type=gated_rsvp_yes'))
  expect(prisma.emailLog.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { emailType: 'gated_rsvp_yes' } })
  )
  expect(prisma.emailLog.count).toHaveBeenCalledWith({ where: { emailType: 'gated_rsvp_yes' } })
})

it('flags capped when total exceeds the cap', async () => {
  ;(prisma.emailLog.count as jest.Mock).mockResolvedValue(750)
  const res = (await GET(req())) as { body: { capped: boolean } }
  expect(res.body.capped).toBe(true)
})
