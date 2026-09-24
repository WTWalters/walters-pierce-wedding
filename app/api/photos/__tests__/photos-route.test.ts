// Mirrors app/api/rsvp/__tests__/submit-route.test.ts: the route's
// `error instanceof Prisma.PrismaClientKnownRequestError` check needs a
// constructible class, so mock @prisma/client with one.
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
import { Prisma } from '@prisma/client'

jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    photo: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), count: jest.fn() },
  },
}))
jest.mock('@/lib/cloudinary', () => ({
  isCloudinaryConfigured: jest.fn().mockReturnValue(true),
  verifyGuestPhoto: jest.fn(),
  photoUrls: jest.fn().mockReturnValue({ fileUrl: 'F', thumbnailUrl: 'T', downloadUrl: 'D' }),
}))

import { GET, POST } from '../route'
import { PAGE_SIZE, cursorFor } from '@/lib/photo-paging'
import { prisma } from '@/lib/prisma'
import { verifyGuestPhoto, photoUrls } from '@/lib/cloudinary'

const dbPhoto = {
  id: 'p1', uploadedByName: 'Ann', caption: null, fileUrl: 'F', thumbnailUrl: 'T', deviceId: 'dev-1',
  createdAt: new Date('2026-09-20'),
  likes: [{ deviceId: 'dev-1' }],
  comments: [{ id: 'c1', authorName: 'Bo', comment: 'hi', createdAt: new Date('2026-09-20') }],
}

const makeGet = (url: string) => ({ url }) as never
const makePost = (json: unknown) => ({ json: async () => json }) as never

beforeEach(() => {
  jest.clearAllMocks()
  ;(require('@/lib/cloudinary').photoUrls as jest.Mock).mockReturnValue({ fileUrl: 'F', thumbnailUrl: 'T', downloadUrl: 'D' })
  ;(prisma.photo.count as jest.Mock).mockResolvedValue(1)
})

describe('GET', () => {
  it('lists visible photos with like count and likedByMe', async () => {
    ;(prisma.photo.findMany as jest.Mock).mockResolvedValue([dbPhoto])
    const res = (await GET(makeGet('http://x/api/photos?deviceId=dev-1'))) as {
      body: { photos: Array<Record<string, unknown>> }
    }
    expect(prisma.photo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isHidden: false, category: 'guest' } })
    )
    expect(res.body.photos[0]).toMatchObject({ id: 'p1', likeCount: 1, likedByMe: true, mine: true })
  })

  it('likedByMe is false for other devices', async () => {
    ;(prisma.photo.findMany as jest.Mock).mockResolvedValue([dbPhoto])
    const res = (await GET(makeGet('http://x/api/photos?deviceId=other'))) as {
      body: { photos: Array<Record<string, unknown>> }
    }
    expect(res.body.photos[0]).toMatchObject({ likeCount: 1, likedByMe: false, mine: false })
  })

  // "Download" saves the original, told to save rather than open. A row from before
  // public ids were kept can only offer what it has.
  it('offers each photo as a download', async () => {
    ;(prisma.photo.findMany as jest.Mock).mockResolvedValue([
      { ...dbPhoto, id: 'p1', cloudinaryPublicId: 'guest-photos/abc' },
      { ...dbPhoto, id: 'p2', cloudinaryPublicId: null },
    ])
    const res = (await GET(makeGet('http://x/api/photos?deviceId=dev-1'))) as {
      body: { photos: Array<Record<string, unknown>> }
    }
    expect(res.body.photos[0].downloadUrl).toBe('D')
    expect(photoUrls).toHaveBeenCalledWith('guest-photos/abc')
    expect(res.body.photos[1].downloadUrl).toBe('F')
  })

  it('never leaks the raw deviceId to the client', async () => {
    ;(prisma.photo.findMany as jest.Mock).mockResolvedValue([dbPhoto])
    const res = (await GET(makeGet('http://x/api/photos?deviceId=dev-1'))) as {
      body: { photos: Array<Record<string, unknown>> }
    }
    expect(res.body.photos[0]).not.toHaveProperty('deviceId')
  })
})

// The gallery used to stop at the newest 200. With a hundred guests sending five to
// ten photos each from home, most of the wedding would have been invisible.
describe('GET, paged', () => {
  type Page = { body: { photos: Array<{ id: string }>; nextCursor: string | null; total: number }; status: number }
  const rows = (n: number, from = 0) =>
    Array.from({ length: n }, (_, k) => ({
      ...dbPhoto,
      id: `00000000-0000-4000-8000-${String(from + k).padStart(12, '0')}`,
      createdAt: new Date(Date.UTC(2026, 8, 12, 20, 0, 0, 999 - (from + k))),
    }))

  it('asks for the newest first, one more than a page, to learn whether there is more', async () => {
    ;(prisma.photo.findMany as jest.Mock).mockResolvedValue(rows(3))
    await GET(makeGet('http://x/api/photos?deviceId=dev-1'))
    expect(prisma.photo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isHidden: false, category: 'guest' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: PAGE_SIZE + 1,
      })
    )
  })

  it('a gallery that fits in a page has no next cursor', async () => {
    ;(prisma.photo.findMany as jest.Mock).mockResolvedValue(rows(3))
    ;(prisma.photo.count as jest.Mock).mockResolvedValue(3)
    const res = (await GET(makeGet('http://x/api/photos?deviceId=dev-1'))) as Page
    expect(res.body.photos).toHaveLength(3)
    expect(res.body.nextCursor).toBeNull()
    expect(res.body.total).toBe(3)
  })

  it('a full page hands back exactly a page and a cursor at its last photo', async () => {
    const all = rows(PAGE_SIZE + 1)
    ;(prisma.photo.findMany as jest.Mock).mockResolvedValue(all)
    ;(prisma.photo.count as jest.Mock).mockResolvedValue(312)
    const res = (await GET(makeGet('http://x/api/photos?deviceId=dev-1'))) as Page
    expect(res.body.photos).toHaveLength(PAGE_SIZE)
    expect(res.body.photos[PAGE_SIZE - 1].id).toBe(all[PAGE_SIZE - 1].id)
    expect(res.body.nextCursor).toBe(cursorFor(all[PAGE_SIZE - 1]))
    expect(res.body.total).toBe(312)
  })

  // Keyset on (createdAt, id), not an offset: a photo uploaded mid-scroll lands at the
  // top and shifts nothing underneath, and the cursor still works if its own photo
  // has since been deleted.
  it('a cursor asks only for photos older than the one it names', async () => {
    const last = rows(1)[0]
    ;(prisma.photo.findMany as jest.Mock).mockResolvedValue([])
    await GET(makeGet(`http://x/api/photos?deviceId=dev-1&cursor=${encodeURIComponent(cursorFor(last))}`))
    expect(prisma.photo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isHidden: false,
          category: 'guest',
          OR: [
            { createdAt: { lt: last.createdAt } },
            { createdAt: last.createdAt, id: { lt: last.id } },
          ],
        },
      })
    )
    // The total is the whole gallery, not what is left after the cursor.
    expect(prisma.photo.count).toHaveBeenCalledWith({ where: { isHidden: false, category: 'guest' } })
  })

  it('refuses a cursor it did not write', async () => {
    const res = (await GET(makeGet('http://x/api/photos?deviceId=dev-1&cursor=page-2'))) as Page
    expect(res.status).toBe(400)
    expect(prisma.photo.findMany).not.toHaveBeenCalled()
  })

  it('the cursor survives a round trip through a URL', async () => {
    const last = rows(1)[0]
    const c = cursorFor(last)
    expect(decodeURIComponent(encodeURIComponent(c))).toBe(c)
    expect(c).toBe('2026-09-12T20:00:00.999Z_00000000-0000-4000-8000-000000000000')
  })
})

describe('POST', () => {
  const valid = { publicId: 'guest-photos/abc', name: 'Ann', caption: 'us!' }

  it('creates a photo after verifying the asset', async () => {
    ;(verifyGuestPhoto as jest.Mock).mockResolvedValue({ secureUrl: 'S' })
    ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.photo.create as jest.Mock).mockResolvedValue({ id: 'new' })
    const res = (await POST(makePost(valid))) as { body: Record<string, unknown>; status: number }
    expect(res.status).toBe(200)
    expect(prisma.photo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        category: 'guest', uploadedByName: 'Ann', caption: 'us!',
        cloudinaryPublicId: 'guest-photos/abc', fileUrl: 'F', thumbnailUrl: 'T',
        isApproved: true,
      }),
    })
  })

  it('422s when the asset cannot be verified', async () => {
    ;(verifyGuestPhoto as jest.Mock).mockResolvedValue(null)
    const res = (await POST(makePost(valid))) as { status: number }
    expect(res.status).toBe(422)
    expect(prisma.photo.create).not.toHaveBeenCalled()
  })

  it('409s on duplicate publicId', async () => {
    ;(verifyGuestPhoto as jest.Mock).mockResolvedValue({ secureUrl: 'S' })
    ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' })
    const res = (await POST(makePost(valid))) as { status: number }
    expect(res.status).toBe(409)
  })

  it('400s on validation failure (name too long)', async () => {
    const res = (await POST(makePost({ ...valid, name: 'x'.repeat(101) }))) as { status: number }
    expect(res.status).toBe(400)
  })

  it('409s when the create loses a duplicate race (P2002)', async () => {
    ;(verifyGuestPhoto as jest.Mock).mockResolvedValue({ secureUrl: 'S' })
    ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.photo.create as jest.Mock).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' })
    )
    const res = (await POST(makePost(valid))) as { body: { error: string }; status: number }
    expect(res.status).toBe(409)
    expect(res.body).toEqual({ error: 'Photo already added' })
  })

  it('400s on malformed JSON body', async () => {
    const badRequest = { json: async () => Promise.reject(new SyntaxError('bad json')) } as never
    const res = (await POST(badRequest)) as { status: number }
    expect(res.status).toBe(400)
    expect(prisma.photo.create).not.toHaveBeenCalled()
  })

  it('records the uploader deviceId when provided', async () => {
    ;(verifyGuestPhoto as jest.Mock).mockResolvedValue({ secureUrl: 'S' })
    ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.photo.create as jest.Mock).mockResolvedValue({ id: 'new' })
    await POST(makePost({ ...valid, deviceId: 'dev-9' }))
    expect(prisma.photo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ deviceId: 'dev-9' }),
    })
  })
})
