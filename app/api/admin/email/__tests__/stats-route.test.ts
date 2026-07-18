jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { emailLog: { count: jest.fn() } } }))

import { getServerSession } from 'next-auth'
import { GET } from '../stats/route'
import { prisma } from '@/lib/prisma'

const req = () => ({ url: 'http://x' }) as never

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
})

it('401s non-admin', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  const res = (await GET(req())) as { status: number }
  expect(res.status).toBe(401)
})

it('computes the six tiles with a correct open rate', async () => {
  // count() call order: total, failed, delivered, opened, bounced, complained
  ;(prisma.emailLog.count as jest.Mock)
    .mockResolvedValueOnce(100) // total
    .mockResolvedValueOnce(4)   // failed
    .mockResolvedValueOnce(80)  // delivered (status delivered OR opened)
    .mockResolvedValueOnce(40)  // opened
    .mockResolvedValueOnce(6)   // bounced
    .mockResolvedValueOnce(2)   // complained
  const res = (await GET(req())) as { body: Record<string, number> }
  expect(res.body).toEqual({ sent: 96, delivered: 80, opened: 40, openRate: 50, bounced: 6, failed: 4, complained: 2 })
})

it('reports a 0 open rate when nothing is delivered (no divide-by-zero)', async () => {
  ;(prisma.emailLog.count as jest.Mock)
    .mockResolvedValueOnce(3).mockResolvedValueOnce(3) // total, failed
    .mockResolvedValueOnce(0).mockResolvedValueOnce(0) // delivered, opened
    .mockResolvedValueOnce(0).mockResolvedValueOnce(0) // bounced, complained
  const res = (await GET(req())) as { body: Record<string, number> }
  expect(res.body.openRate).toBe(0)
  expect(res.body.sent).toBe(0)
})
