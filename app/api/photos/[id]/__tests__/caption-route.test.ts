jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { photo: { findFirst: jest.fn(), update: jest.fn() } } }))
jest.mock('@/lib/cloudinary', () => ({ destroyPhoto: jest.fn() }))

import { getServerSession } from 'next-auth'
import { PATCH } from '../route'
import { prisma } from '@/lib/prisma'

type Res = { status: number; body: Record<string, unknown> }
const req = (body: unknown) => ({ url: 'http://x/api/photos/p1', json: async () => body }) as never
const ctx = { params: Promise.resolve({ id: 'p1' }) }
const saved = () => (prisma.photo.update as jest.Mock).mock.calls[0][0].data

const guestPhoto = { id: 'p1', category: 'guest', cloudinaryPublicId: 'guest-photos/abc', deviceId: 'dev-1' }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue(guestPhoto)
  ;(prisma.photo.update as jest.Mock).mockResolvedValue({})
})

describe('who may caption a photo', () => {
  it('lets the guest who shared it caption their own', async () => {
    const res = (await PATCH(req({ caption: 'The first dance', deviceId: 'dev-1' }), ctx)) as Res
    expect(res.status).toBe(200)
    expect(saved().caption).toBe('The first dance')
  })

  // "Just in case" — Nicolle fixing a typo, or taking down something unwelcome.
  it('lets an admin caption any photo', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
    const res = (await PATCH(req({ caption: 'Cutting the cake', deviceId: '' }), ctx)) as Res
    expect(res.status).toBe(200)
  })

  it('refuses a guest editing somebody else’s photo', async () => {
    const res = (await PATCH(req({ caption: 'mine now', deviceId: 'dev-2' }), ctx)) as Res
    expect(res.status).toBe(403)
    expect(prisma.photo.update).not.toHaveBeenCalled()
  })

  it('refuses when no deviceId is offered at all', async () => {
    const res = (await PATCH(req({ caption: 'hello' }), ctx)) as Res
    expect(res.status).toBe(403)
    expect(prisma.photo.update).not.toHaveBeenCalled()
  })

  // A photo with no uploader token can't be owned by anyone presenting a blank one.
  it('refuses a blank deviceId against a photo that has none', async () => {
    ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue({ ...guestPhoto, deviceId: null })
    const res = (await PATCH(req({ caption: 'hello', deviceId: '' }), ctx)) as Res
    expect(res.status).toBe(403)
  })
})

describe('the caption itself', () => {
  it('is trimmed', async () => {
    await PATCH(req({ caption: '   Under the lights   ', deviceId: 'dev-1' }), ctx)
    expect(saved().caption).toBe('Under the lights')
  })

  // Cleared back to null, not '', so "has a caption" stays one test everywhere.
  it('clears to null when emptied', async () => {
    await PATCH(req({ caption: '   ', deviceId: 'dev-1' }), ctx)
    expect(saved().caption).toBeNull()
  })

  it('accepts one right at the 280 limit', async () => {
    const res = (await PATCH(req({ caption: 'x'.repeat(280), deviceId: 'dev-1' }), ctx)) as Res
    expect(res.status).toBe(200)
  })

  it('rejects one past the limit rather than silently truncating', async () => {
    const res = (await PATCH(req({ caption: 'x'.repeat(281), deviceId: 'dev-1' }), ctx)) as Res
    expect(res.status).toBe(400)
    expect(prisma.photo.update).not.toHaveBeenCalled()
  })

  it('returns what was stored, so the page can show it without a refetch', async () => {
    const res = (await PATCH(req({ caption: 'The first dance', deviceId: 'dev-1' }), ctx)) as Res
    expect(res.body.caption).toBe('The first dance')
  })
})

it('404s a photo that does not exist', async () => {
  ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue(null)
  const res = (await PATCH(req({ caption: 'hi', deviceId: 'dev-1' }), ctx)) as Res
  expect(res.status).toBe(404)
})

// Scoped to guest photos, like every other route here, so captioning can never
// reach an engagement photo or anything else that isn't part of the guest gallery.
it('only touches guest photos', async () => {
  await PATCH(req({ caption: 'hi', deviceId: 'dev-1' }), ctx)
  expect((prisma.photo.findFirst as jest.Mock).mock.calls[0][0].where).toMatchObject({ category: 'guest' })
})

it('survives a body that is not JSON', async () => {
  const bad = { url: 'http://x', json: async () => { throw new Error('nope') } } as never
  const res = (await PATCH(bad, ctx)) as Res
  // Nothing to authorize against, so it must not write.
  expect(prisma.photo.update).not.toHaveBeenCalled()
  expect([400, 403]).toContain(res.status)
})
