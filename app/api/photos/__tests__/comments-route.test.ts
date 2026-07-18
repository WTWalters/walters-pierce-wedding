jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    photo: { findFirst: jest.fn() },
    photoComment: { create: jest.fn() },
  },
}))

import { POST } from '../[id]/comments/route'
import { prisma } from '@/lib/prisma'

const makeRequest = (json: unknown) => ({ json: async () => json }) as never
const ctx = { params: Promise.resolve({ id: 'p1' }) }

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue({ id: 'p1' })
})

it('creates a visible comment', async () => {
  ;(prisma.photoComment.create as jest.Mock).mockResolvedValue({
    id: 'c1', authorName: 'Bo', comment: 'lovely', createdAt: new Date('2026-09-20'),
  })
  const res = (await POST(makeRequest({ name: 'Bo', comment: 'lovely' }), ctx)) as {
    body: Record<string, unknown>; status: number
  }
  expect(res.status).toBe(200)
  expect(prisma.photoComment.create).toHaveBeenCalledWith({
    data: { photoId: 'p1', authorName: 'Bo', comment: 'lovely', isApproved: true },
  })
  expect(res.body).toMatchObject({ comment: { id: 'c1', authorName: 'Bo' } })
})

it('404s for hidden/unknown photo', async () => {
  ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue(null)
  const res = (await POST(makeRequest({ name: 'Bo', comment: 'x' }), ctx)) as { status: number }
  expect(res.status).toBe(404)
})

it('400s on comment over 500 chars', async () => {
  const res = (await POST(makeRequest({ name: 'Bo', comment: 'x'.repeat(501) }), ctx)) as { status: number }
  expect(res.status).toBe(400)
})

it('400s on empty name', async () => {
  const res = (await POST(makeRequest({ name: '  ', comment: 'hi' }), ctx)) as { status: number }
  expect(res.status).toBe(400)
})

it('400s on malformed JSON body', async () => {
  const req = { json: async () => { throw new Error('bad json') } } as never
  const res = (await POST(req, ctx)) as { status: number }
  expect(res.status).toBe(400)
  expect(prisma.photoComment.create).not.toHaveBeenCalled()
})
