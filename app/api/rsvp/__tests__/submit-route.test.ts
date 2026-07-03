/**
 * Tests the P2002 double-submit retry path and response indistinguishability
 * of POST /api/rsvp/submit.
 *
 * Adaptation: under this repo's babel-jest transform, `@prisma/client`'s
 * `Prisma.PrismaClientKnownRequestError` resolves to a function whose
 * `.prototype` is `undefined` (an interop quirk of the generated Prisma
 * client, not something this test controls), which makes `new` and
 * `instanceof` against the real export unusable here. We mock `@prisma/client`
 * with a real class of the same name/shape so the route's
 * `error instanceof Prisma.PrismaClientKnownRequestError` check — and the
 * retry behavior it guards — is still exercised faithfully.
 */
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
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    }),
  },
}))
jest.mock('@/lib/rsvp', () => ({
  rsvpSchema: { safeParse: jest.fn() },
  processRsvpSubmission: jest.fn(),
}))

import { POST } from '../submit/route'
import { rsvpSchema, processRsvpSubmission } from '@/lib/rsvp'

const validData = { firstName: 'A', lastName: 'B', email: 'a@b.c', attending: true, partySize: 1 }
const makeRequest = (json: unknown = validData) =>
  ({ json: async () => json }) as never

beforeEach(() => {
  jest.clearAllMocks()
  ;(rsvpSchema.safeParse as jest.Mock).mockReturnValue({ success: true, data: validData })
})

it('returns identical shape for blocked and saved outcomes', async () => {
  ;(processRsvpSubmission as jest.Mock).mockResolvedValueOnce({ outcome: 'saved', matched: true })
  const saved = (await POST(makeRequest())) as { body: Record<string, unknown>; status: number }
  ;(processRsvpSubmission as jest.Mock).mockResolvedValueOnce({ outcome: 'blocked' })
  const blocked = (await POST(makeRequest())) as { body: Record<string, unknown>; status: number }
  expect(saved.body).toEqual(blocked.body)
  expect(saved.body).toEqual({ ok: true, attending: true })
})

it('retries exactly once on P2002 and succeeds', async () => {
  const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
    code: 'P2002', clientVersion: 'test',
  })
  ;(processRsvpSubmission as jest.Mock)
    .mockRejectedValueOnce(p2002)
    .mockResolvedValueOnce({ outcome: 'saved', matched: false })
  const res = (await POST(makeRequest())) as { status: number }
  expect(res.status).toBe(200)
  expect(processRsvpSubmission).toHaveBeenCalledTimes(2)
})

it('does not retry non-P2002 errors', async () => {
  ;(processRsvpSubmission as jest.Mock).mockRejectedValueOnce(new Error('db down'))
  const res = (await POST(makeRequest())) as { status: number }
  expect(res.status).toBe(500)
  expect(processRsvpSubmission).toHaveBeenCalledTimes(1)
})

it('400s on schema failure', async () => {
  ;(rsvpSchema.safeParse as jest.Mock).mockReturnValue({
    success: false, error: { issues: [{ message: 'Party size required' }] },
  })
  const res = (await POST(makeRequest())) as { body: { error: string }; status: number }
  expect(res.status).toBe(400)
  expect(res.body.error).toBe('Party size required')
})
