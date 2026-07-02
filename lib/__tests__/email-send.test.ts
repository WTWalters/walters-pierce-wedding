import { sendEmail } from '@/lib/email'

jest.mock('@/lib/prisma', () => ({ prisma: { emailLog: { create: jest.fn() } } }))

describe('sendEmail', () => {
  const OLD_ENV = process.env
  afterEach(() => { process.env = OLD_ENV })

  it('fails honestly when RESEND_API_KEY is missing', async () => {
    process.env = { ...OLD_ENV }
    delete process.env.RESEND_API_KEY
    const result = await sendEmail({ to: 'x@y.com', subject: 's', html: '<p>h</p>' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/not configured/i)
  })
})
