jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    photo: { findMany: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn(), delete: jest.fn() },
    photoComment: { updateMany: jest.fn(), deleteMany: jest.fn() },
  },
}))
jest.mock('@/lib/cloudinary', () => ({ destroyPhoto: jest.fn() }))

import { getServerSession } from 'next-auth'
import { GET } from '../route'
import { PATCH, DELETE } from '../[id]/route'
import { PATCH as commentPatch, DELETE as commentDelete } from '../[id]/comments/[commentId]/route'
import { prisma } from '@/lib/prisma'
import { destroyPhoto } from '@/lib/cloudinary'

const admin = { user: { role: 'admin' } }
const makeRequest = (json: unknown = {}) => ({ json: async () => json, url: 'http://x' }) as never
const photoCtx = { params: Promise.resolve({ id: 'p1' }) }
const commentCtx = { params: Promise.resolve({ id: 'p1', commentId: 'c1' }) }

const allRoutes = () => [
  () => GET(makeRequest()),
  () => PATCH(makeRequest({ isHidden: true }), photoCtx),
  () => DELETE(makeRequest(), photoCtx),
  () => commentPatch(makeRequest({ isHidden: true }), commentCtx),
  () => commentDelete(makeRequest(), commentCtx),
]

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue(admin)
})

it('every route 401s without a session', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  for (const call of allRoutes()) {
    const res = (await call()) as { status: number }
    expect(res.status).toBe(401)
  }
})

it('every route 401s for an authenticated non-admin (the real privilege boundary)', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'guest' } })
  for (const call of allRoutes()) {
    const res = (await call()) as { status: number }
    expect(res.status).toBe(401)
  }
  // no DB access past the guard
  expect(prisma.photo.updateMany).not.toHaveBeenCalled()
  expect(prisma.photo.delete).not.toHaveBeenCalled()
  expect(prisma.photoComment.deleteMany).not.toHaveBeenCalled()
})

it('GET returns all guest photos including hidden', async () => {
  ;(prisma.photo.findMany as jest.Mock).mockResolvedValue([])
  await GET(makeRequest())
  expect(prisma.photo.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { category: 'guest' } })
  )
})

it('PATCH toggles isHidden, scoped to guest photos', async () => {
  ;(prisma.photo.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
  const res = (await PATCH(makeRequest({ isHidden: true }), photoCtx)) as {
    status: number; body: Record<string, unknown>
  }
  expect(res.status).toBe(200)
  expect(res.body).toEqual({ ok: true, isHidden: true })
  expect(prisma.photo.updateMany).toHaveBeenCalledWith({
    where: { id: 'p1', category: 'guest' }, data: { isHidden: true },
  })
})

it('PATCH 404s a non-guest / missing photo instead of 500', async () => {
  ;(prisma.photo.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
  const res = (await PATCH(makeRequest({ isHidden: true }), photoCtx)) as { status: number }
  expect(res.status).toBe(404)
})

it('DELETE destroys the Cloudinary asset then the row', async () => {
  ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue({
    id: 'p1', cloudinaryPublicId: 'guest-photos/abc',
  })
  await DELETE(makeRequest(), photoCtx)
  expect(prisma.photo.findFirst).toHaveBeenCalledWith({ where: { id: 'p1', category: 'guest' } })
  expect(destroyPhoto).toHaveBeenCalledWith('guest-photos/abc')
  expect(prisma.photo.delete).toHaveBeenCalledWith({ where: { id: 'p1' } })
})

it('DELETE still deletes the row when there is no Cloudinary id', async () => {
  ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue({ id: 'p1', cloudinaryPublicId: null })
  await DELETE(makeRequest(), photoCtx)
  expect(destroyPhoto).not.toHaveBeenCalled()
  expect(prisma.photo.delete).toHaveBeenCalled()
})

it('DELETE 404s a non-guest / missing photo', async () => {
  ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue(null)
  const res = (await DELETE(makeRequest(), photoCtx)) as { status: number }
  expect(res.status).toBe(404)
  expect(destroyPhoto).not.toHaveBeenCalled()
  expect(prisma.photo.delete).not.toHaveBeenCalled()
})

it('comment PATCH and DELETE are scoped to the photo in the URL', async () => {
  ;(prisma.photoComment.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
  await commentPatch(makeRequest({ isHidden: true }), commentCtx)
  expect(prisma.photoComment.updateMany).toHaveBeenCalledWith({
    where: { id: 'c1', photoId: 'p1' }, data: { isHidden: true },
  })
  ;(prisma.photoComment.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
  await commentDelete(makeRequest(), commentCtx)
  expect(prisma.photoComment.deleteMany).toHaveBeenCalledWith({ where: { id: 'c1', photoId: 'p1' } })
})

it('comment PATCH/DELETE 404 when the comment does not belong to that photo', async () => {
  ;(prisma.photoComment.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
  const patchRes = (await commentPatch(makeRequest({ isHidden: true }), commentCtx)) as { status: number }
  expect(patchRes.status).toBe(404)
  ;(prisma.photoComment.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })
  const delRes = (await commentDelete(makeRequest(), commentCtx)) as { status: number }
  expect(delRes.status).toBe(404)
})
