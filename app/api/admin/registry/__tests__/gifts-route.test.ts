jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { contribution: { create: jest.fn() } } }))

import { getServerSession } from 'next-auth'
import { POST } from '../gifts/route'
import { prisma } from '@/lib/prisma'

const req = (json: unknown) => ({ json: async () => json }) as never
const VALID = { contributorName: 'Aunt Sue', contributorEmail: 'sue@x.com', giftDescription: 'cheque', amount: '150', givenOn: '2026-07-04' }
const created = () => (prisma.contribution.create as jest.Mock).mock.calls[0][0].data

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
  ;(prisma.contribution.create as jest.Mock).mockResolvedValue({ id: 'gift1' })
})

it('records a gift Nicolle entered', async () => {
  const res = (await POST(req(VALID))) as unknown as { status: number; body: Record<string, unknown> }
  expect(res.status).toBe(200)
  expect(created()).toMatchObject({
    contributorName: 'Aunt Sue',
    contributorEmail: 'sue@x.com',
    giftDescription: 'cheque',
    amount: 150,
    source: 'manual',
  })
})

// Tier progress and the public registry page read RegistryItem.amountRaised. A
// hand-recorded gift must never carry a tier, or her bookkeeping would move a
// number the guests can see.
it('never attaches a registry tier', async () => {
  await POST(req(VALID))
  expect(created().registryItemId).toBeUndefined()
})

it('marks it manual so the list can label it', async () => {
  await POST(req(VALID))
  expect(created().source).toBe('manual')
})

describe('the date', () => {
  it('keeps the day she typed, not the day before', async () => {
    await POST(req({ ...VALID, givenOn: '2026-07-04' }))
    const at: Date = created().createdAt
    // Parsed at noon local, so converting to a date string can't slip a day.
    expect(at.getFullYear()).toBe(2026)
    expect(at.getMonth()).toBe(6)
    expect(at.getDate()).toBe(4)
  })

  it('defaults to now when she leaves it blank', async () => {
    const before = Date.now()
    await POST(req({ ...VALID, givenOn: undefined }))
    const at: Date = created().createdAt
    expect(at.getTime()).toBeGreaterThanOrEqual(before)
  })

  it('rejects a date that is not yyyy-mm-dd', async () => {
    const res = (await POST(req({ ...VALID, givenOn: '4th July' }))) as unknown as { status: number }
    expect(res.status).toBe(400)
    expect(prisma.contribution.create).not.toHaveBeenCalled()
  })
})

describe('email', () => {
  // Required+unique email on the guest list is what produced her
  // "please-correct@your.emailaddy.com" placeholders. Don't repeat it here.
  it('is optional — a cash gift may have none', async () => {
    const res = (await POST(req({ ...VALID, contributorEmail: '' }))) as unknown as { status: number }
    expect(res.status).toBe(200)
    expect(created().contributorEmail).toBe('')
  })

  it('is lowercased so the thank-you lookup matches', async () => {
    await POST(req({ ...VALID, contributorEmail: 'Sue@X.com' }))
    expect(created().contributorEmail).toBe('sue@x.com')
  })

  it('is rejected when it is obviously not an address', async () => {
    const res = (await POST(req({ ...VALID, contributorEmail: 'not-an-email' }))) as unknown as { status: number }
    expect(res.status).toBe(400)
    expect(prisma.contribution.create).not.toHaveBeenCalled()
  })
})

describe('amount', () => {
  // Nicolle: "I tried to add Aunt Marilyn's gift of a cake serving set and it's
  // requiring an amount... If someone has given a physical gift there should never
  // be an amount shown (obviously)."
  it('may be left blank for a physical present', async () => {
    const res = (await POST(req({ ...VALID, amount: '', giftDescription: 'Cake Serving Set' }))) as unknown as { status: number }
    expect(res.status).toBe(200)
    expect(created().amount).toBe(0)
  })

  it('may be omitted entirely', async () => {
    const body = { ...VALID, giftDescription: 'Cake Serving Set' }
    delete (body as Record<string, unknown>).amount
    const res = (await POST(req(body))) as unknown as { status: number }
    expect(res.status).toBe(200)
    expect(created().amount).toBe(0)
  })

  it('accepts 0', async () => {
    const res = (await POST(req({ ...VALID, amount: '0' }))) as unknown as { status: number }
    expect(res.status).toBe(200)
    expect(created().amount).toBe(0)
  })

  it('rejects a negative amount', async () => {
    const res = (await POST(req({ ...VALID, amount: '-50' }))) as unknown as { status: number }
    expect(res.status).toBe(400)
  })
})

// Neither an amount nor a description is a row that says nothing, and a thank-you
// that can only manage "your generous gift".
it('requires either an amount or a description', async () => {
  const res = (await POST(req({ ...VALID, amount: '', giftDescription: '' }))) as unknown as { status: number; body: { error: string } }
  expect(res.status).toBe(400)
  expect(res.body.error).toMatch(/amount|describe/i)
  expect(prisma.contribution.create).not.toHaveBeenCalled()
})

it('accepts a description with no amount, and an amount with no description', async () => {
  const present = (await POST(req({ ...VALID, amount: '', giftDescription: 'Cake Serving Set' }))) as unknown as { status: number }
  expect(present.status).toBe(200)
  ;(prisma.contribution.create as jest.Mock).mockClear()
  const cash = (await POST(req({ ...VALID, amount: '100', giftDescription: '' }))) as unknown as { status: number }
  expect(cash.status).toBe(200)
})

it('requires a name', async () => {
  const res = (await POST(req({ ...VALID, contributorName: '  ' }))) as unknown as { status: number; body: { error: string } }
  expect(res.status).toBe(400)
  expect(res.body.error).toMatch(/name/i)
})

it('401s a non-admin', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  const res = (await POST(req(VALID))) as unknown as { status: number }
  expect(res.status).toBe(401)
  expect(prisma.contribution.create).not.toHaveBeenCalled()
})
