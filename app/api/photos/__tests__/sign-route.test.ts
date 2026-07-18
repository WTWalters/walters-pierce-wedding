jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}))
jest.mock('@/lib/cloudinary', () => ({
  isCloudinaryConfigured: jest.fn(),
  signUploadParams: jest.fn(),
}))
jest.mock('@/lib/rate-limit', () => ({ checkRateLimit: jest.fn() }))

import { POST } from '../sign/route'
import { isCloudinaryConfigured, signUploadParams } from '@/lib/cloudinary'
import { checkRateLimit } from '@/lib/rate-limit'

const makeRequest = (ip = '1.2.3.4') =>
  ({ headers: new Map([['x-forwarded-for', ip]]) }) as never

beforeEach(() => {
  jest.clearAllMocks()
  ;(isCloudinaryConfigured as jest.Mock).mockReturnValue(true)
  ;(checkRateLimit as jest.Mock).mockReturnValue(true)
  ;(signUploadParams as jest.Mock).mockReturnValue({ signature: 's', timestamp: 1 })
})

it('returns signing params', async () => {
  const res = (await POST(makeRequest())) as { body: Record<string, unknown>; status: number }
  expect(res.status).toBe(200)
  expect(res.body).toEqual({ signature: 's', timestamp: 1 })
  expect(checkRateLimit).toHaveBeenCalledWith('photo-sign:1.2.3.4', 3000, 3600000)
})

it('rate-limits on the last x-forwarded-for hop, ignoring spoofed prefixes', async () => {
  // Railway's proxy APPENDS the real client IP, so the last entry is trusted;
  // leftmost entries can be sent by the client itself.
  await POST(makeRequest('6.6.6.6, 1.2.3.4'))
  expect(checkRateLimit).toHaveBeenCalledWith('photo-sign:1.2.3.4', 3000, 3600000)
})

it('falls back to the shared unknown bucket without the header', async () => {
  await POST({ headers: new Map() } as never)
  expect(checkRateLimit).toHaveBeenCalledWith('photo-sign:unknown', 3000, 3600000)
})

it('500s without leaking details when signing throws', async () => {
  ;(signUploadParams as jest.Mock).mockImplementation(() => {
    throw new Error('secret internal detail')
  })
  const res = (await POST(makeRequest())) as { body: Record<string, unknown>; status: number }
  expect(res.status).toBe(500)
  expect(res.body).toEqual({ error: 'Failed to prepare upload' })
})

it('503s when Cloudinary is unconfigured', async () => {
  ;(isCloudinaryConfigured as jest.Mock).mockReturnValue(false)
  const res = (await POST(makeRequest())) as { status: number }
  expect(res.status).toBe(503)
})

it('429s past the rate limit', async () => {
  ;(checkRateLimit as jest.Mock).mockReturnValue(false)
  const res = (await POST(makeRequest())) as { status: number }
  expect(res.status).toBe(429)
  expect(signUploadParams).not.toHaveBeenCalled()
})
