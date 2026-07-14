jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}))
jest.mock('@prisma/client', () => {
  class MockPrismaClientKnownRequestError extends Error {
    code: string
    clientVersion: string
    constructor(message: string, opts: { code: string; clientVersion: string }) {
      super(message)
      this.code = opts.code
      this.clientVersion = opts.clientVersion
    }
  }
  return { Prisma: { PrismaClientKnownRequestError: MockPrismaClientKnownRequestError } }
})
jest.mock('@/lib/prisma', () => ({
  prisma: {
    photo: { findFirst: jest.fn() },
    photoLike: { create: jest.fn(), deleteMany: jest.fn(), count: jest.fn() },
  },
}))

import { Prisma } from '@prisma/client'
import { POST } from '../[id]/like/route'
import { prisma } from '@/lib/prisma'

const makeRequest = (json: unknown) => ({ json: async () => json }) as never
const ctx = { params: Promise.resolve({ id: 'p1' }) }

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue({ id: 'p1' })
  ;(prisma.photoLike.count as jest.Mock).mockResolvedValue(5)
})

it('likes when no existing like', async () => {
  ;(prisma.photoLike.create as jest.Mock).mockResolvedValue({})
  const res = (await POST(makeRequest({ deviceId: 'd1-abcdefgh' }), ctx)) as { body: Record<string, unknown> }
  expect(res.body).toEqual({ liked: true, likeCount: 5 })
})

it('unlikes on P2002 (already liked)', async () => {
  ;(prisma.photoLike.create as jest.Mock).mockRejectedValue(
    new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' })
  )
  const res = (await POST(makeRequest({ deviceId: 'd1-abcdefgh' }), ctx)) as { body: Record<string, unknown> }
  expect(prisma.photoLike.deleteMany).toHaveBeenCalledWith({
    where: { photoId: 'p1', deviceId: 'd1-abcdefgh' },
  })
  expect(res.body).toEqual({ liked: false, likeCount: 5 })
})

it('404s for unknown or hidden photo', async () => {
  ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue(null)
  const res = (await POST(makeRequest({ deviceId: 'd1-abcdefgh' }), ctx)) as { status: number }
  expect(res.status).toBe(404)
})

it('400s without deviceId', async () => {
  const res = (await POST(makeRequest({}), ctx)) as { status: number }
  expect(res.status).toBe(400)
})

it('400s on malformed JSON body', async () => {
  const req = { json: async () => { throw new Error('bad json') } } as never
  const res = (await POST(req, ctx)) as { status: number }
  expect(res.status).toBe(400)
  expect(prisma.photoLike.create).not.toHaveBeenCalled()
})
