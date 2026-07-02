import { processRsvpSubmission, rsvpSchema } from '@/lib/rsvp'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    guest: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
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

  it('nulls partySize when declining', async () => {
    mockPrisma.guest.findUnique.mockResolvedValue(null)
    mockPrisma.guest.create.mockResolvedValue({ id: 'g4' })
    await processRsvpSubmission({ ...input, attending: false, partySize: undefined })
    expect(mockPrisma.guest.create.mock.calls[0][0].data.partySize).toBeNull()
  })
})
