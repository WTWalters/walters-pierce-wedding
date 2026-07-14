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
    photo: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    photoComment: { update: jest.fn(), delete: jest.fn() },
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

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue(admin)
})

it('every route 401s without an admin session', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  for (const call of [
    () => GET(makeRequest()),
    () => PATCH(makeRequest({ isHidden: true }), photoCtx),
    () => DELETE(makeRequest(), photoCtx),
    () => commentPatch(makeRequest({ isHidden: true }), commentCtx),
    () => commentDelete(makeRequest(), commentCtx),
  ]) {
    const res = (await call()) as { status: number }
    expect(res.status).toBe(401)
  }
})

it('GET returns all guest photos including hidden', async () => {
  ;(prisma.photo.findMany as jest.Mock).mockResolvedValue([])
  await GET(makeRequest())
  expect(prisma.photo.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { category: 'guest' } })
  )
})

it('PATCH toggles isHidden', async () => {
  ;(prisma.photo.update as jest.Mock).mockResolvedValue({ id: 'p1', isHidden: true })
  const res = (await PATCH(makeRequest({ isHidden: true }), photoCtx)) as { status: number }
  expect(res.status).toBe(200)
  expect(prisma.photo.update).toHaveBeenCalledWith({
    where: { id: 'p1' }, data: { isHidden: true },
  })
})

it('DELETE destroys the Cloudinary asset then the row', async () => {
  ;(prisma.photo.findUnique as jest.Mock).mockResolvedValue({
    id: 'p1', cloudinaryPublicId: 'guest-photos/abc',
  })
  await DELETE(makeRequest(), photoCtx)
  expect(destroyPhoto).toHaveBeenCalledWith('guest-photos/abc')
  expect(prisma.photo.delete).toHaveBeenCalledWith({ where: { id: 'p1' } })
})

it('DELETE still deletes the row when there is no Cloudinary id', async () => {
  ;(prisma.photo.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', cloudinaryPublicId: null })
  await DELETE(makeRequest(), photoCtx)
  expect(destroyPhoto).not.toHaveBeenCalled()
  expect(prisma.photo.delete).toHaveBeenCalled()
})

it('comment PATCH and DELETE hit photoComment', async () => {
  ;(prisma.photoComment.update as jest.Mock).mockResolvedValue({})
  await commentPatch(makeRequest({ isHidden: true }), commentCtx)
  expect(prisma.photoComment.update).toHaveBeenCalledWith({
    where: { id: 'c1' }, data: { isHidden: true },
  })
  await commentDelete(makeRequest(), commentCtx)
  expect(prisma.photoComment.delete).toHaveBeenCalledWith({ where: { id: 'c1' } })
})
