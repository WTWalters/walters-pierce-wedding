jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { photo: { findFirst: jest.fn(), delete: jest.fn() } } }))
jest.mock('@/lib/cloudinary', () => ({ destroyPhoto: jest.fn() }))

import { getServerSession } from 'next-auth'
import { DELETE } from '../route'
import { prisma } from '@/lib/prisma'
import { destroyPhoto } from '@/lib/cloudinary'

const req = (deviceId?: string) =>
  ({ url: `http://x/api/photos/p1${deviceId ? `?deviceId=${deviceId}` : ''}` }) as never
const ctx = { params: Promise.resolve({ id: 'p1' }) }

const guestPhoto = { id: 'p1', category: 'guest', cloudinaryPublicId: 'guest-photos/abc', deviceId: 'dev-1' }

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue(guestPhoto)
  ;(prisma.photo.delete as jest.Mock).mockResolvedValue({})
})

it('404s when the photo does not exist', async () => {
  ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue(null)
  const res = (await DELETE(req('dev-1'), ctx)) as { status: number }
  expect(res.status).toBe(404)
  expect(prisma.photo.delete).not.toHaveBeenCalled()
})

it('lets an admin session delete any photo (no deviceId)', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
  const res = (await DELETE(req(), ctx)) as { body: unknown; status: number }
  expect(res.status).toBe(200)
  expect(destroyPhoto).toHaveBeenCalledWith('guest-photos/abc')
  expect(prisma.photo.delete).toHaveBeenCalledWith({ where: { id: 'p1' } })
})

it('lets the uploading device delete its own photo (no session)', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  const res = (await DELETE(req('dev-1'), ctx)) as { status: number }
  expect(res.status).toBe(200)
  expect(prisma.photo.delete).toHaveBeenCalledWith({ where: { id: 'p1' } })
})

it('403s a non-admin with a mismatched deviceId', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  const res = (await DELETE(req('someone-else'), ctx)) as { status: number }
  expect(res.status).toBe(403)
  expect(prisma.photo.delete).not.toHaveBeenCalled()
})

it('403s a non-admin with no deviceId', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  const res = (await DELETE(req(), ctx)) as { status: number }
  expect(res.status).toBe(403)
  expect(prisma.photo.delete).not.toHaveBeenCalled()
})

it('does not require a Cloudinary destroy when there is no public id', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
  ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue({ ...guestPhoto, cloudinaryPublicId: null })
  const res = (await DELETE(req(), ctx)) as { status: number }
  expect(res.status).toBe(200)
  expect(destroyPhoto).not.toHaveBeenCalled()
})
