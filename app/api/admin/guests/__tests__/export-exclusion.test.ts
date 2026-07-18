jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {
    body: unknown
    status: number
    headers: Record<string, string>
    constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this.body = body
      this.status = init?.status ?? 200
      this.headers = init?.headers ?? {}
    }
    static json(body: unknown, init?: { status?: number }) {
      return { body, status: init?.status ?? 200 }
    }
  },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { guest: { findMany: jest.fn() } } }))

import { getServerSession } from 'next-auth'
import { GET } from '../export/route'
import { prisma } from '@/lib/prisma'

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
  ;(prisma.guest.findMany as jest.Mock).mockResolvedValue([])
})

it('CSV export excludes awaiting-review submissions', async () => {
  await GET({ url: 'http://x' } as never)
  expect(prisma.guest.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { NOT: { source: 'self_rsvp', reviewedAt: null } } })
  )
})
