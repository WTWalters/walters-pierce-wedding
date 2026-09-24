jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}))
jest.mock('@/lib/prisma', () => ({ prisma: { photo: { findMany: jest.fn() } } }))
jest.mock('@/lib/cloudinary', () => ({
  isCloudinaryConfigured: jest.fn().mockReturnValue(true),
  zipDownloadUrl: jest.fn().mockReturnValue('https://res.cloudinary.com/x/image/generate_archive?signed'),
  ZIP_LIMIT: 100,
}))
jest.mock('@/lib/rate-limit', () => ({ checkRateLimit: jest.fn().mockReturnValue(true) }))

import { POST } from '../download/route'
import { prisma } from '@/lib/prisma'
import { isCloudinaryConfigured, zipDownloadUrl } from '@/lib/cloudinary'
import { checkRateLimit } from '@/lib/rate-limit'

// Whitney, 2026-09-24: "we need a way to download them either to the local drive
// or to the phone." Several photos at once come down as one zip that Cloudinary
// builds; this route turns the gallery's ids into the signed link for it.

type Res = { body: { url?: string; count?: number; error?: string }; status: number }
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const req = (json: unknown, ip = '203.0.113.9') =>
  ({ json: async () => json, headers: { get: (h: string) => (h === 'x-forwarded-for' ? `10.0.0.1, ${ip}` : null) } }) as never

beforeEach(() => {
  jest.clearAllMocks()
  ;(isCloudinaryConfigured as jest.Mock).mockReturnValue(true)
  ;(checkRateLimit as jest.Mock).mockReturnValue(true)
  ;(zipDownloadUrl as jest.Mock).mockReturnValue('https://res.cloudinary.com/x/image/generate_archive?signed')
  ;(prisma.photo.findMany as jest.Mock).mockResolvedValue([
    { cloudinaryPublicId: 'guest-photos/a' },
    { cloudinaryPublicId: 'guest-photos/b' },
  ])
})

it('hands back a signed zip link for the chosen photos', async () => {
  const res = (await POST(req({ ids: [id(1), id(2)] }))) as Res
  expect(res.status).toBe(200)
  expect(res.body.url).toContain('generate_archive')
  expect(res.body.count).toBe(2)
  expect(zipDownloadUrl).toHaveBeenCalledWith(['guest-photos/a', 'guest-photos/b'])
})

// The ids come from the browser. Only photos that are actually on the gallery —
// not hidden, guest-uploaded, with a Cloudinary asset behind them — go in the zip.
it('looks up only visible gallery photos by the ids it was given', async () => {
  await POST(req({ ids: [id(1), id(2)] }))
  expect(prisma.photo.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        id: { in: [id(1), id(2)] },
        isHidden: false,
        category: 'guest',
        cloudinaryPublicId: { not: null },
      },
    })
  )
})

it('404s when none of the ids are photos anyone can see', async () => {
  ;(prisma.photo.findMany as jest.Mock).mockResolvedValue([])
  const res = (await POST(req({ ids: [id(1)] }))) as Res
  expect(res.status).toBe(404)
  expect(zipDownloadUrl).not.toHaveBeenCalled()
})

it.each([
  ['no ids', { ids: [] }],
  ['ids that are not ids', { ids: ['../etc/passwd'] }],
  ['more than a zip may hold', { ids: Array.from({ length: 101 }, (_, i) => id(i)) }],
  ['no body at all', null],
])('400s on %s', async (_label, body) => {
  const res = (await POST(req(body))) as Res
  expect(res.status).toBe(400)
  expect(prisma.photo.findMany).not.toHaveBeenCalled()
})

it('503s while Cloudinary is not configured', async () => {
  ;(isCloudinaryConfigured as jest.Mock).mockReturnValue(false)
  const res = (await POST(req({ ids: [id(1)] }))) as Res
  expect(res.status).toBe(503)
})

// Every zip is delivered at full size; one address gets twenty an hour.
it('rate-limits by the real client IP, the last forwarded hop', async () => {
  ;(checkRateLimit as jest.Mock).mockReturnValue(false)
  const res = (await POST(req({ ids: [id(1)] }, '198.51.100.7'))) as Res
  expect(res.status).toBe(429)
  expect(checkRateLimit).toHaveBeenCalledWith('photo-zip:198.51.100.7', 20, 60 * 60 * 1000)
  expect(prisma.photo.findMany).not.toHaveBeenCalled()
})

it('500s, without leaking the cause, when the lookup fails', async () => {
  const quiet = jest.spyOn(console, 'error').mockImplementation(() => {})
  ;(prisma.photo.findMany as jest.Mock).mockRejectedValue(new Error('db down'))
  const res = (await POST(req({ ids: [id(1)] }))) as Res
  expect(res.status).toBe(500)
  expect(res.body.error).not.toContain('db down')
  quiet.mockRestore()
})
