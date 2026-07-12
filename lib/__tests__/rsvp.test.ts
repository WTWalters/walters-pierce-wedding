import { processRsvpSubmission, rsvpSchema } from '@/lib/rsvp'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    guest: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), create: jest.fn() },
    auditLog: { create: jest.fn() },
    emailLog: { create: jest.fn() },
    setting: { findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-1' }),
  logEmail: jest.fn(),
  NOTIFY_EMAIL: 'notify@test',
  COORDINATOR_FROM: 'Coordinator <c@test>',
}))

const mockPrisma = prisma as jest.Mocked<any>

const input = {
  firstName: 'Jane', lastName: 'Smith', email: 'Jane@X.com',
  attending: true, partySize: 2, dietaryRestrictions: '', songRequest: 'ABBA',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPrisma.setting.findUnique.mockResolvedValue({
    value: JSON.stringify(['tom walters']),
  })
  mockPrisma.guest.findMany.mockResolvedValue([])
})

describe('rsvpSchema', () => {
  it('requires partySize when attending', () => {
    const r = rsvpSchema.safeParse({ ...input, partySize: undefined })
    expect(r.success).toBe(false)
  })
  it('allows missing partySize when declining', () => {
    const r = rsvpSchema.safeParse({ ...input, attending: false, partySize: undefined })
    expect(r.success).toBe(true)
  })
})

describe('processRsvpSubmission', () => {
  it('short-circuits blocked names: audit log, notification, no guest write', async () => {
    const result = await processRsvpSubmission({ ...input, firstName: 'Tom', lastName: 'Walters' })
    expect(result.outcome).toBe('blocked')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'rsvp_blocked' }) })
    )
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(mockPrisma.guest.findUnique).not.toHaveBeenCalled()
    expect(mockPrisma.guest.create).not.toHaveBeenCalled()
  })

  it('updates a matched guest by lowercased email and reports matched=true', async () => {
    mockPrisma.guest.findUnique.mockResolvedValue({
      id: 'g1', email: 'jane@x.com', firstName: '', lastName: '', source: 'imported',
    })
    mockPrisma.guest.update.mockResolvedValue({ id: 'g1' })
    const result = await processRsvpSubmission(input)
    expect(result).toEqual({ outcome: 'saved', matched: true })
    expect(mockPrisma.guest.findUnique).toHaveBeenCalledWith({ where: { email: 'jane@x.com' } })
    const updateArg = mockPrisma.guest.update.mock.calls[0][0]
    expect(updateArg.data.firstName).toBe('Jane') // fills empty name on file
    expect(updateArg.data.partySize).toBe(2)
  })

  it('creates an unmatched guest with source=self_rsvp', async () => {
    mockPrisma.guest.findUnique.mockResolvedValue(null)
    mockPrisma.guest.create.mockResolvedValue({ id: 'g2' })
    const result = await processRsvpSubmission(input)
    expect(result).toEqual({ outcome: 'saved', matched: false })
    expect(mockPrisma.guest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ source: 'self_rsvp', email: 'jane@x.com' }) })
    )
  })

  it('still saves the RSVP if the notification email throws', async () => {
    mockPrisma.guest.findUnique.mockResolvedValue(null)
    mockPrisma.guest.create.mockResolvedValue({ id: 'g3' })
    ;(sendEmail as jest.Mock).mockRejectedValueOnce(new Error('resend down'))
    const result = await processRsvpSubmission(input)
    expect(result.outcome).toBe('saved')
  })

  it('falls back to unambiguous name matching when email is unknown, without touching the email on file', async () => {
    mockPrisma.guest.findUnique.mockResolvedValue(null)
    mockPrisma.guest.findMany.mockResolvedValue([
      { id: 'g5', email: 'old-address@x.com', firstName: 'Jane', lastName: 'Smith', source: 'imported' },
      { id: 'g6', email: 'other@x.com', firstName: 'Bob', lastName: 'Jones', source: 'imported' },
    ])
    mockPrisma.guest.update.mockResolvedValue({ id: 'g5' })
    const result = await processRsvpSubmission(input)
    expect(result).toEqual({ outcome: 'saved', matched: true })
    expect(mockPrisma.guest.create).not.toHaveBeenCalled()
    const updateArg = mockPrisma.guest.update.mock.calls[0][0]
    expect(updateArg.where).toEqual({ id: 'g5' })
    expect(updateArg.data.email).toBeUndefined() // email on file is never overwritten
    expect(updateArg.data.firstName).toBeUndefined() // name on file kept as-is
  })

  it('matches names case- and accent-insensitively', async () => {
    mockPrisma.guest.findUnique.mockResolvedValue(null)
    mockPrisma.guest.findMany.mockResolvedValue([
      { id: 'g7', email: 'jane@old.com', firstName: 'JANE', lastName: 'Smíth', source: 'imported' },
    ])
    mockPrisma.guest.update.mockResolvedValue({ id: 'g7' })
    const result = await processRsvpSubmission(input)
    expect(result).toEqual({ outcome: 'saved', matched: true })
  })

  it('creates a new guest when the name matches more than one record (ambiguous)', async () => {
    mockPrisma.guest.findUnique.mockResolvedValue(null)
    mockPrisma.guest.findMany.mockResolvedValue([
      { id: 'g8', email: 'a@x.com', firstName: 'Jane', lastName: 'Smith', source: 'imported' },
      { id: 'g9', email: 'b@x.com', firstName: 'Jane', lastName: 'Smith', source: 'self_rsvp' },
    ])
    mockPrisma.guest.create.mockResolvedValue({ id: 'g10' })
    const result = await processRsvpSubmission(input)
    expect(result).toEqual({ outcome: 'saved', matched: false })
    expect(mockPrisma.guest.update).not.toHaveBeenCalled()
    expect(mockPrisma.guest.create).toHaveBeenCalled()
  })

  it('nulls partySize when declining', async () => {
    mockPrisma.guest.findUnique.mockResolvedValue(null)
    mockPrisma.guest.create.mockResolvedValue({ id: 'g4' })
    await processRsvpSubmission({ ...input, attending: false, partySize: undefined })
    expect(mockPrisma.guest.create.mock.calls[0][0].data.partySize).toBeNull()
  })

  it('matches a submission against a party partner name without overwriting email on file', async () => {
    mockPrisma.guest.findUnique.mockResolvedValue(null) // no email match
    mockPrisma.guest.findMany.mockResolvedValue([
      { id: 'g1', email: 'andre@x.com', firstName: 'Andre', lastName: 'Justen-Pratt',
        partnerFirstName: 'Chloe', partnerLastName: 'Hirai', source: 'imported', reservedSeats: null },
    ])
    mockPrisma.guest.update.mockResolvedValue({ id: 'g1' })

    const res = await processRsvpSubmission({
      firstName: 'Chloe', lastName: 'Hirai', email: 'chloe-new@x.com',
      attending: true, partySize: 2,
    })

    expect(res).toEqual({ outcome: 'saved', matched: true })
    const updateArg = mockPrisma.guest.update.mock.calls[0][0]
    expect(updateArg.where).toEqual({ id: 'g1' })
    expect(updateArg.data.email).toBeUndefined() // email on file not overwritten by a name match
  })

  it('rejects a matched submission whose party size exceeds reserved seats (no write)', async () => {
    mockPrisma.guest.findUnique.mockResolvedValue({
      id: 'g1', email: 'callie@x.com', firstName: 'Callie', lastName: 'Clark',
      source: 'imported', reservedSeats: 7,
    })

    const res = await processRsvpSubmission({
      firstName: 'Callie', lastName: 'Clark', email: 'callie@x.com',
      attending: true, partySize: 9,
    })

    expect(res).toEqual({ outcome: 'over_cap', reservedSeats: 7 })
    expect(mockPrisma.guest.update).not.toHaveBeenCalled()
  })

  it('allows a matched submission equal to reserved seats', async () => {
    mockPrisma.guest.findUnique.mockResolvedValue({
      id: 'g1', email: 'callie@x.com', firstName: 'Callie', lastName: 'Clark',
      source: 'imported', reservedSeats: 7,
    })
    mockPrisma.guest.update.mockResolvedValue({ id: 'g1' })

    const res = await processRsvpSubmission({
      firstName: 'Callie', lastName: 'Clark', email: 'callie@x.com',
      attending: true, partySize: 7,
    })

    expect(res).toEqual({ outcome: 'saved', matched: true })
  })

  it('does not cap an unmatched submitter (still saved and flagged)', async () => {
    mockPrisma.guest.findUnique.mockResolvedValue(null)
    mockPrisma.guest.findMany.mockResolvedValue([]) // no name match
    mockPrisma.guest.create.mockResolvedValue({ id: 'new1' })

    const res = await processRsvpSubmission({
      firstName: 'Unknown', lastName: 'Person', email: 'unknown@x.com',
      attending: true, partySize: 8,
    })

    expect(res).toEqual({ outcome: 'saved', matched: false })
    expect(mockPrisma.guest.create).toHaveBeenCalled()
  })
})
