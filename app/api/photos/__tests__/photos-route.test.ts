jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    photo: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  },
}))
jest.mock('@/lib/cloudinary', () => ({
  isCloudinaryConfigured: jest.fn().mockReturnValue(true),
  verifyGuestPhoto: jest.fn(),
  photoUrls: jest.fn().mockReturnValue({ fileUrl: 'F', thumbnailUrl: 'T' }),
}))

import { GET, POST } from '../route'
import { prisma } from '@/lib/prisma'
import { verifyGuestPhoto } from '@/lib/cloudinary'

const dbPhoto = {
  id: 'p1', uploadedByName: 'Ann', caption: null, fileUrl: 'F', thumbnailUrl: 'T',
  createdAt: new Date('2026-09-20'),
  likes: [{ deviceId: 'dev-1' }],
  comments: [{ id: 'c1', authorName: 'Bo', comment: 'hi', createdAt: new Date('2026-09-20') }],
}

const makeGet = (url: string) => ({ url }) as never
const makePost = (json: unknown) => ({ json: async () => json }) as never

beforeEach(() => {
  jest.clearAllMocks()
  ;(require('@/lib/cloudinary').photoUrls as jest.Mock).mockReturnValue({ fileUrl: 'F', thumbnailUrl: 'T' })
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
    expect(res.body.photos[0]).toMatchObject({ id: 'p1', likeCount: 1, likedByMe: true })
  })

  it('likedByMe is false for other devices', async () => {
    ;(prisma.photo.findMany as jest.Mock).mockResolvedValue([dbPhoto])
    const res = (await GET(makeGet('http://x/api/photos?deviceId=other'))) as {
      body: { photos: Array<Record<string, unknown>> }
    }
    expect(res.body.photos[0]).toMatchObject({ likeCount: 1, likedByMe: false })
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
})
