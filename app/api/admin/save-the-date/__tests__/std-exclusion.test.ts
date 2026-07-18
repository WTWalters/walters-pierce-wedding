jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    guest: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    emailLog: { count: jest.fn() },
  },
}))
jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn(),
  generateSaveTheDateEmail: jest.fn(),
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST as generateCodes } from '../generate-codes/route'
import { POST as sendStd } from '../send/route'
import { GET as stdStats } from '../stats/route'

const EXCLUDE = { NOT: { source: 'self_rsvp', reviewedAt: null } }
const req = () => ({ url: 'http://x' }) as never

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
  ;(prisma.guest.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.guest.count as jest.Mock).mockResolvedValue(0)
  ;(prisma.emailLog.count as jest.Mock).mockResolvedValue(0)
})

it('generate-codes excludes awaiting-review guests from findMany', async () => {
  await generateCodes(req())
  expect(prisma.guest.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ invitationCode: null, ...EXCLUDE }),
    })
  )
})

it('send excludes awaiting-review guests from findMany', async () => {
  await sendStd(req())
  expect(prisma.guest.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        invitationCode: { not: null },
        invitationSentAt: null,
        ...EXCLUDE,
      }),
    })
  )
})

it('stats excludes awaiting-review guests from every guest count', async () => {
  await stdStats()
  const calls = (prisma.guest.count as jest.Mock).mock.calls.map((c) => c[0])
  expect(calls).toContainEqual(expect.objectContaining({ where: expect.objectContaining(EXCLUDE) }))
  expect(calls.length).toBeGreaterThanOrEqual(3)
  for (const call of calls) {
    expect(call.where).toEqual(expect.objectContaining(EXCLUDE))
  }
})
