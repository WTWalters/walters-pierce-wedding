/** Webhook signature rejection + unconfigured behavior. */
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    }),
  },
}))
jest.mock('@/lib/prisma', () => ({ prisma: { emailLog: { updateMany: jest.fn() } } }))

import { POST } from '../resend/route'

const makeRequest = () =>
  ({
    text: async () => '{}',
    headers: { get: () => 'bogus' },
  }) as never

const OLD_ENV = process.env
afterEach(() => { process.env = OLD_ENV })

it('503s when RESEND_WEBHOOK_SECRET is unset', async () => {
  process.env = { ...OLD_ENV }
  delete process.env.RESEND_WEBHOOK_SECRET
  const res = (await POST(makeRequest())) as { status: number }
  expect(res.status).toBe(503)
})

it('400s on invalid signature', async () => {
  process.env = { ...OLD_ENV, RESEND_WEBHOOK_SECRET: 'whsec_' + Buffer.from('testsecret').toString('base64') }
  const res = (await POST(makeRequest())) as { status: number }
  expect(res.status).toBe(400)
})
