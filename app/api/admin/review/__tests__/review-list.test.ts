jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { guest: { findMany: jest.fn() } } }))

import { getServerSession } from 'next-auth'
import { GET } from '../route'
import { prisma } from '@/lib/prisma'

const req = () => ({ url: 'http://x' }) as never

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
})

it('returns awaiting-review submissions with a count', async () => {
  ;(prisma.guest.findMany as jest.Mock).mockResolvedValue([{ id: 'a' }, { id: 'b' }])
  const res = (await GET(req())) as { body: { submissions: unknown[]; count: number } }
  expect(prisma.guest.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { source: 'self_rsvp', reviewedAt: null } })
  )
  expect(res.body.count).toBe(2)
  expect(res.body.submissions).toHaveLength(2)
})

it('401s non-admin', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  const res = (await GET(req())) as { status: number }
  expect(res.status).toBe(401)
})
