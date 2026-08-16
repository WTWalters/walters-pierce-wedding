jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contribution: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    guest: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}))

import { getServerSession } from 'next-auth'
import { PUT, PATCH, DELETE } from '../gifts/[id]/route'
import { prisma } from '@/lib/prisma'

const ctx = { params: Promise.resolve({ id: 'gift1' }) }
const req = (json: unknown) => ({ json: async () => json }) as never
const VALID = {
  contributorName: 'Marilyn Hinrichs',
  contributorEmail: 'mjhinrichs@msn.com',
  giftDescription: 'gorgeous cake serving set',
  amount: '',
  givenOn: '2026-07-21',
}
const updated = () => (prisma.contribution.update as jest.Mock).mock.calls[0][0]

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
  ;(prisma.contribution.findFirst as jest.Mock).mockResolvedValue({ id: 'gift1', source: 'manual' })
  ;(prisma.contribution.update as jest.Mock).mockResolvedValue({})
})

// Her actual problem: she entered $0.01 to get past the old required-amount rule.
it('lets her clear the amount she only entered to satisfy the old form', async () => {
  const res = (await PUT(req(VALID), ctx)) as unknown as { status: number }
  expect(res.status).toBe(200)
  expect(updated().data.amount).toBe(0)
  expect(updated().data.giftDescription).toBe('gorgeous cake serving set')
})

it('updates the name and email', async () => {
  await PUT(req({ ...VALID, contributorName: 'Aunt Marilyn', contributorEmail: 'New@X.com' }), ctx)
  expect(updated().data.contributorName).toBe('Aunt Marilyn')
  expect(updated().data.contributorEmail).toBe('new@x.com') // lowercased for the gift lookup
})

// Nicolle: "I don't need / want to edit ones that come in from the website". It's also
// the safe boundary — a Stripe amount is tied to a real payment and a tier's total.
describe('only gifts she recorded by hand', () => {
  it('refuses a Stripe contribution', async () => {
    ;(prisma.contribution.findFirst as jest.Mock).mockResolvedValue(null)
    const res = (await PUT(req(VALID), ctx)) as unknown as { status: number; body: { error: string } }
    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/recorded by hand/i)
    expect(prisma.contribution.update).not.toHaveBeenCalled()
  })

  // Enforced in the query, so a stale page still showing an Edit link can't get through.
  it('scopes the lookup to source=manual rather than trusting the caller', async () => {
    await PUT(req(VALID), ctx)
    expect(prisma.contribution.findFirst).toHaveBeenCalledWith({
      where: { id: 'gift1', source: 'manual' },
    })
  })
})

describe('the date', () => {
  it('keeps the day she typed', async () => {
    await PUT(req({ ...VALID, givenOn: '2026-07-21' }), ctx)
    const at: Date = updated().data.createdAt
    expect([at.getFullYear(), at.getMonth(), at.getDate()]).toEqual([2026, 6, 21])
  })

  // Re-stamping an untouched gift with today would quietly rewrite her records.
  it('is left alone when she does not set one', async () => {
    const body = { ...VALID }
    delete (body as Record<string, unknown>).givenOn
    await PUT(req(body), ctx)
    expect(updated().data.createdAt).toBeUndefined()
  })
})

describe('validation matches the add form', () => {
  it('rejects an empty name', async () => {
    const res = (await PUT(req({ ...VALID, contributorName: '  ' }), ctx)) as unknown as { status: number }
    expect(res.status).toBe(400)
    expect(prisma.contribution.update).not.toHaveBeenCalled()
  })

  it('rejects clearing both the amount and the description', async () => {
    const res = (await PUT(req({ ...VALID, amount: '', giftDescription: '' }), ctx)) as unknown as { status: number; body: { error: string } }
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/amount|describe/i)
  })

  it('rejects a malformed email', async () => {
    const res = (await PUT(req({ ...VALID, contributorEmail: 'nope' }), ctx)) as unknown as { status: number }
    expect(res.status).toBe(400)
  })
})

it('401s a non-admin', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  const res = (await PUT(req(VALID), ctx)) as unknown as { status: number }
  expect(res.status).toBe(401)
  expect(prisma.contribution.update).not.toHaveBeenCalled()
})

// Nicolle: "I need a button to delete a gift added as well."
describe('DELETE', () => {
  const existing = {
    id: 'gift1',
    source: 'manual',
    contributorName: 'Aunt Marilyn',
    contributorEmail: 'mjhinrichs@msn.com',
    giftDescription: 'Beautiful engraved cake serving set',
    amount: 0,
    createdAt: new Date('2026-07-27T12:00:00.000Z'),
  }
  const del = () => DELETE({} as never, ctx)

  beforeEach(() => {
    ;(prisma.contribution.findFirst as jest.Mock).mockResolvedValue(existing)
    ;(prisma.contribution.delete as jest.Mock).mockResolvedValue({})
    ;(prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'a1' })
  })

  it('deletes a gift she recorded', async () => {
    const res = (await del()) as unknown as { status: number }
    expect(res.status).toBe(200)
    expect(prisma.contribution.delete).toHaveBeenCalledWith({ where: { id: 'gift1' } })
  })

  // Deleting a Stripe row would erase a payment that really happened and leave its
  // tier counting money with nothing behind it.
  it('refuses a Stripe contribution', async () => {
    ;(prisma.contribution.findFirst as jest.Mock).mockResolvedValue(null)
    const res = (await del()) as unknown as { status: number; body: { error: string } }
    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/recorded by hand/i)
    expect(prisma.contribution.delete).not.toHaveBeenCalled()
  })

  it('scopes the lookup to source=manual', async () => {
    await del()
    expect(prisma.contribution.findFirst).toHaveBeenCalledWith({
      where: { id: 'gift1', source: 'manual' },
    })
  })

  // The row is the only record of the gift, and a mis-click is otherwise final.
  it('keeps a copy of what was deleted', async () => {
    await del()
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'gift_deleted',
        entityId: 'gift1',
        oldValues: expect.objectContaining({
          contributorName: 'Aunt Marilyn',
          giftDescription: 'Beautiful engraved cake serving set',
        }),
      }),
    })
  })

  it('still reports success if the audit write fails', async () => {
    ;(prisma.auditLog.create as jest.Mock).mockRejectedValueOnce(new Error('audit gone'))
    const res = (await del()) as unknown as { status: number }
    expect(res.status).toBe(200)
  })

  it('401s a non-admin', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = (await del()) as unknown as { status: number }
    expect(res.status).toBe(401)
    expect(prisma.contribution.delete).not.toHaveBeenCalled()
  })
})

// Linking a gift to the guest who gave it. Unlike PUT, this is allowed on gifts that
// came through the website: the case Nicolle named is the $25 through "Buy Me a
// Coffee", a Stripe gift with no Edit button at all.
describe('PATCH — linking a gift to a guest', () => {
  const GUEST = '11111111-1111-4111-8111-111111111111'

  beforeEach(() => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
    ;(prisma.contribution.findUnique as jest.Mock).mockResolvedValue({ id: 'gift1' })
    ;(prisma.guest.findUnique as jest.Mock).mockResolvedValue({ id: GUEST })
  })

  it('stores the link', async () => {
    const res = (await PATCH(req({ guestId: GUEST }), ctx)) as unknown as { status: number }
    expect(res.status).toBe(200)
    expect(prisma.contribution.update).toHaveBeenCalledWith({
      where: { id: 'gift1' },
      data: { guestId: GUEST },
    })
  })

  // The whole point: a Stripe gift can be linked even though it can't be edited.
  it('works on a gift that came from the website', async () => {
    ;(prisma.contribution.findUnique as jest.Mock).mockResolvedValue({ id: 'gift1', source: null })
    const res = (await PATCH(req({ guestId: GUEST }), ctx)) as unknown as { status: number }
    expect(res.status).toBe(200)
  })

  it('touches nothing but the link, so a real payment keeps its amount', async () => {
    await PATCH(req({ guestId: GUEST }), ctx)
    expect((prisma.contribution.update as jest.Mock).mock.calls[0][0].data).toEqual({ guestId: GUEST })
  })

  it('clears the link, falling back to name and email matching', async () => {
    await PATCH(req({ guestId: '' }), ctx)
    expect((prisma.contribution.update as jest.Mock).mock.calls[0][0].data).toEqual({ guestId: null })
  })

  it('rejects a guest who is no longer on the list', async () => {
    ;(prisma.guest.findUnique as jest.Mock).mockResolvedValue(null)
    const res = (await PATCH(req({ guestId: GUEST }), ctx)) as unknown as { status: number }
    expect(res.status).toBe(400)
    expect(prisma.contribution.update).not.toHaveBeenCalled()
  })

  it('rejects something that is not an id', async () => {
    const res = (await PATCH(req({ guestId: 'marilyn' }), ctx)) as unknown as { status: number }
    expect(res.status).toBe(400)
    expect(prisma.contribution.update).not.toHaveBeenCalled()
  })

  it('404s a gift that no longer exists', async () => {
    ;(prisma.contribution.findUnique as jest.Mock).mockResolvedValue(null)
    const res = (await PATCH(req({ guestId: GUEST }), ctx)) as unknown as { status: number }
    expect(res.status).toBe(404)
  })

  it('401s a non-admin', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = (await PATCH(req({ guestId: GUEST }), ctx)) as unknown as { status: number }
    expect(res.status).toBe(401)
    expect(prisma.contribution.update).not.toHaveBeenCalled()
  })
})
