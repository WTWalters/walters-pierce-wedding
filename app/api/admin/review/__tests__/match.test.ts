jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: {
  guest: { findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn().mockResolvedValue([]),
} }))

import { getServerSession } from 'next-auth'
import { POST } from '../[id]/match/route'
import { prisma } from '@/lib/prisma'

const ctx = { params: Promise.resolve({ id: 'sub1' }) }
const req = (json: unknown) => ({ json: async () => json }) as never
const submission = { id: 'sub1', attending: true, rsvpdCount: 2, partySize: 2, dietaryRestrictions: 'veg', songRequest: 'ABBA', rsvpReceivedAt: new Date('2026-09-01'), email: 'guest@x.com', firstName: 'Sam', lastName: 'Smith' }
const target = { id: 'tgt1', source: 'imported', reservedSeats: 4, email: 'official@x.com', firstName: 'Samuel', lastName: 'Smith' }

const matchOk = () => {
  ;(prisma.guest.findFirst as jest.Mock)
    .mockResolvedValueOnce(submission) // submission lookup
    .mockResolvedValueOnce(target)     // target lookup
  ;(prisma.guest.update as jest.Mock).mockResolvedValue({})
  ;(prisma.guest.delete as jest.Mock).mockResolvedValue({})
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
  ;(prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-1' })
})

it('copies RSVP data onto the target, deletes the submission, never touches target identity', async () => {
  matchOk()
  const res = (await POST(req({ targetGuestId: '22222222-2222-4222-8222-222222222222' }), ctx)) as { status: number; body: Record<string, unknown> }
  expect(res.status).toBe(200)
  const upd = (prisma.guest.update as jest.Mock).mock.calls[0][0]
  expect(upd.where).toEqual({ id: 'tgt1' })
  expect(upd.data).toEqual({
    attending: true, rsvpdCount: 2, partySize: 2,
    dietaryRestrictions: 'veg', songRequest: 'ABBA', rsvpReceivedAt: submission.rsvpReceivedAt,
    email: 'guest@x.com',
  })
  expect(upd.data.firstName).toBeUndefined()
  expect(prisma.guest.delete).toHaveBeenCalledWith({ where: { id: 'sub1' } })
  expect(res.body).toMatchObject({ ok: true, overCap: false })
})

// Matching is Nicolle confirming the identity by hand, and the target's address is
// often a placeholder. Before this the submitted address died with the submission row.
describe('adopting the submitted email', () => {
  it('reports which address was replaced', async () => {
    matchOk()
    const res = (await POST(req({ targetGuestId: '22222222-2222-4222-8222-222222222222' }), ctx)) as { body: Record<string, unknown> }
    expect(res.body).toMatchObject({ emailReplaced: 'official@x.com' })
  })

  it('keeps the replaced address in the audit log', async () => {
    matchOk()
    await POST(req({ targetGuestId: '22222222-2222-4222-8222-222222222222' }), ctx)
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'match_email_adopted',
        entityId: 'tgt1',
        oldValues: { email: 'official@x.com' },
        newValues: { email: 'guest@x.com' },
      }),
    })
  })

  // email is unique and the submission row still holds the address being adopted,
  // so the delete has to land first or the update violates the constraint.
  it('deletes the submission before the target adopts its address', async () => {
    matchOk()
    await POST(req({ targetGuestId: '22222222-2222-4222-8222-222222222222' }), ctx)
    const ops = (prisma.$transaction as jest.Mock).mock.calls[0][0]
    expect(ops).toHaveLength(2)
    const order = (prisma.guest.delete as jest.Mock).mock.invocationCallOrder[0]
    expect(order).toBeLessThan((prisma.guest.update as jest.Mock).mock.invocationCallOrder[0])
  })

  it('leaves the address alone when it already matches', async () => {
    ;(prisma.guest.findFirst as jest.Mock)
      .mockResolvedValueOnce(submission)
      .mockResolvedValueOnce({ ...target, email: 'guest@x.com' })
    ;(prisma.guest.update as jest.Mock).mockResolvedValue({})
    ;(prisma.guest.delete as jest.Mock).mockResolvedValue({})
    const res = (await POST(req({ targetGuestId: '22222222-2222-4222-8222-222222222222' }), ctx)) as { body: Record<string, unknown> }
    expect((prisma.guest.update as jest.Mock).mock.calls[0][0].data.email).toBeUndefined()
    expect(res.body).toMatchObject({ emailReplaced: null })
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('still succeeds if the audit write fails', async () => {
    matchOk()
    ;(prisma.auditLog.create as jest.Mock).mockRejectedValueOnce(new Error('audit gone'))
    const res = (await POST(req({ targetGuestId: '22222222-2222-4222-8222-222222222222' }), ctx)) as { status: number }
    expect(res.status).toBe(200)
  })
})

it('flags overCap when submission headcount exceeds target reserved seats', async () => {
  ;(prisma.guest.findFirst as jest.Mock)
    .mockResolvedValueOnce({ ...submission, rsvpdCount: 6 })
    .mockResolvedValueOnce(target)
  ;(prisma.guest.update as jest.Mock).mockResolvedValue({})
  ;(prisma.guest.delete as jest.Mock).mockResolvedValue({})
  const res = (await POST(req({ targetGuestId: '22222222-2222-4222-8222-222222222222' }), ctx)) as { body: Record<string, unknown> }
  expect(res.body).toMatchObject({ ok: true, overCap: true })
})

it('404s when submission is not awaiting review', async () => {
  ;(prisma.guest.findFirst as jest.Mock).mockResolvedValueOnce(null)
  const res = (await POST(req({ targetGuestId: '22222222-2222-4222-8222-222222222222' }), ctx)) as { status: number }
  expect(res.status).toBe(404)
})

it('422s when target is missing or not an official (imported) guest', async () => {
  ;(prisma.guest.findFirst as jest.Mock)
    .mockResolvedValueOnce(submission)
    .mockResolvedValueOnce(null)
  const res = (await POST(req({ targetGuestId: '22222222-2222-4222-8222-222222222222' }), ctx)) as { status: number }
  expect(res.status).toBe(422)
  expect(prisma.guest.delete).not.toHaveBeenCalled()
})

it('400s without a targetGuestId', async () => {
  ;(prisma.guest.findFirst as jest.Mock).mockResolvedValueOnce(submission)
  const res = (await POST(req({}), ctx)) as { status: number }
  expect(res.status).toBe(400)
})

it('401s non-admin', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  const res = (await POST(req({ targetGuestId: '22222222-2222-4222-8222-222222222222' }), ctx)) as { status: number }
  expect(res.status).toBe(401)
})
