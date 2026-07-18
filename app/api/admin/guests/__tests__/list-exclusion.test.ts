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

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
  ;(prisma.guest.findMany as jest.Mock).mockResolvedValue([])
})

it('list excludes awaiting-review submissions', async () => {
  await GET({ url: 'http://x' } as never)
  expect(prisma.guest.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { NOT: { source: 'self_rsvp', reviewedAt: null } } })
  )
})
