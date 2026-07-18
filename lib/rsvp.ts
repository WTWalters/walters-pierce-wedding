import { z } from 'zod'
import { prisma } from './prisma'
import { getBlocklist, isBlockedName, normalizeName } from './blocklist'
import { assertSeatCap } from './guests'
import { guestListStatus, type GuestListStatus } from './review'
import { sendEmail, logEmail, NOTIFY_EMAIL } from './email'
import {
  generateRsvpNotificationEmail,
  generateBlockedAttemptEmail,
} from './email-templates'

export const rsvpSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(200),
    attending: z.boolean(),
    partySize: z.number().int().min(1).max(10).optional(),
    dietaryRestrictions: z.string().trim().max(1000).optional(),
    songRequest: z.string().trim().max(300).optional(),
  })
  .refine((d) => !d.attending || typeof d.partySize === 'number', {
    message: 'Please tell us how many are in your party',
    path: ['partySize'],
  })

export type RsvpInput = z.infer<typeof rsvpSchema>

export type RsvpResult =
  | { outcome: 'blocked' }
  | { outcome: 'over_cap'; reservedSeats: number }
  | { outcome: 'saved'; matched: boolean }

// Notification failures never fail the RSVP — the database row is the source
// of truth; email is a best-effort channel with an honest log.
async function notify(
  template: { subject: string; html: string; text: string },
  emailType: string,
  guestId?: string
) {
  try {
    const res = await sendEmail({ ...template, to: NOTIFY_EMAIL })
    await logEmail({
      guestId: guestId ?? null,
      emailType,
      recipientEmail: NOTIFY_EMAIL,
      subject: template.subject,
      status: res.success ? 'sent' : 'failed',
      resendMessageId: res.success ? res.messageId : null,
    })
  } catch (err) {
    console.error(`Notification (${emailType}) failed:`, err)
  }
}

export async function processRsvpSubmission(input: RsvpInput): Promise<RsvpResult> {
  const blocklist = await getBlocklist()
  if (isBlockedName(input.firstName, input.lastName, blocklist)) {
    await prisma.auditLog.create({
      data: {
        action: 'rsvp_blocked',
        entityType: 'guest',
        newValues: { ...input },
      },
    })
    await notify(generateBlockedAttemptEmail(input), 'blocked_attempt_notification')
    return { outcome: 'blocked' }
  }

  const email = input.email.trim().toLowerCase()
  const headcount = input.attending ? input.partySize ?? 1 : null
  const responseData = {
    attending: input.attending,
    // partySize is legacy; rsvpdCount is the canonical count the admin screens
    // (grid, stats, seat-cap) read. Keep both in sync on every submission.
    partySize: headcount,
    rsvpdCount: headcount,
    dietaryRestrictions: input.dietaryRestrictions || null,
    songRequest: input.songRequest || null,
    rsvpReceivedAt: new Date(),
  }

  const existing = await prisma.guest.findUnique({ where: { email } })
  let guestId: string
  let matched: boolean
  let status: 'matched' | 'added' | 'unmatched'
  let addedAt: Date | undefined
  let matchedBy: 'email' | 'name' | undefined
  let emailOnFile: string | undefined
  if (existing) {
    const emailCap = assertSeatCap({ reservedSeats: existing.reservedSeats, rsvpdCount: responseData.partySize })
    if (!emailCap.ok) return { outcome: 'over_cap', reservedSeats: existing.reservedSeats as number }
    ;({ status, addedAt } = toNotifyStatus(guestListStatus(existing)))
    matched = status === 'matched'
    matchedBy = 'email'
    const updated = await prisma.guest.update({
      where: { id: existing.id },
      data: {
        ...responseData,
        firstName: existing.firstName || input.firstName,
        lastName: existing.lastName || input.lastName,
      },
    })
    guestId = updated.id
  } else {
    // No email match — correlate by name. Only an unambiguous (single) match
    // counts. The email ON FILE is never overwritten here: doing so would let
    // anyone who knows a guest's name capture that guest's gated emails.
    // Nicolle's notification flags the differing address for human review.
    const submittedName = normalizeName(`${input.firstName} ${input.lastName}`)
    const named = await prisma.guest.findMany({
      where: { NOT: [{ firstName: '' }, { lastName: '' }] },
      select: {
        id: true, email: true, firstName: true, lastName: true, source: true,
        reviewedAt: true,
        partnerFirstName: true, partnerLastName: true, reservedSeats: true,
      },
    })
    const nameMatches = named.filter((g) => {
      const primary = normalizeName(`${g.firstName} ${g.lastName}`)
      const partner = g.partnerFirstName
        ? normalizeName(`${g.partnerFirstName} ${g.partnerLastName ?? ''}`)
        : null
      return primary === submittedName || partner === submittedName
    })
    if (nameMatches.length === 1) {
      const byName = nameMatches[0]
      const nameCap = assertSeatCap({ reservedSeats: byName.reservedSeats, rsvpdCount: responseData.partySize })
      if (!nameCap.ok) return { outcome: 'over_cap', reservedSeats: byName.reservedSeats as number }
      ;({ status, addedAt } = toNotifyStatus(guestListStatus(byName)))
      matched = status === 'matched'
      matchedBy = 'name'
      emailOnFile = byName.email
      const updated = await prisma.guest.update({
        where: { id: byName.id },
        data: responseData,
      })
      guestId = updated.id
    } else {
      matched = false
      status = 'unmatched'
      const created = await prisma.guest.create({
        data: {
          ...responseData,
          email,
          firstName: input.firstName,
          lastName: input.lastName,
          source: 'self_rsvp',
        },
      })
      guestId = created.id
    }
  }

  await notify(
    generateRsvpNotificationEmail({ ...input, status, addedAt, matchedBy, emailOnFile }),
    'rsvp_notification',
    guestId
  )
  return { outcome: 'saved', matched }
}

// Collapse the richer list-status into the flags the notification email needs.
// A still-pending self-RSVP reads as 'unmatched' to Nicolle — it's landing in
// To Review either way.
function toNotifyStatus(
  s: GuestListStatus
): { status: 'matched' | 'added' | 'unmatched'; addedAt?: Date } {
  if (s.kind === 'matched') return { status: 'matched' }
  if (s.kind === 'added') return { status: 'added', addedAt: s.addedAt }
  return { status: 'unmatched' }
}
