import { z } from 'zod'
import { prisma } from './prisma'
import { getBlocklist, isBlockedName, normalizeName } from './blocklist'
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

export type RsvpResult = { outcome: 'blocked' } | { outcome: 'saved'; matched: boolean }

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
  const responseData = {
    attending: input.attending,
    partySize: input.attending ? input.partySize ?? 1 : null,
    dietaryRestrictions: input.dietaryRestrictions || null,
    songRequest: input.songRequest || null,
    rsvpReceivedAt: new Date(),
  }

  const existing = await prisma.guest.findUnique({ where: { email } })
  let guestId: string
  let matched: boolean
  let matchedBy: 'email' | 'name' | undefined
  let emailOnFile: string | undefined
  if (existing) {
    matched = existing.source === 'imported'
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
      select: { id: true, email: true, firstName: true, lastName: true, source: true },
    })
    const nameMatches = named.filter(
      (g) => normalizeName(`${g.firstName} ${g.lastName}`) === submittedName
    )
    if (nameMatches.length === 1) {
      const byName = nameMatches[0]
      matched = byName.source === 'imported'
      matchedBy = 'name'
      emailOnFile = byName.email
      const updated = await prisma.guest.update({
        where: { id: byName.id },
        data: responseData,
      })
      guestId = updated.id
    } else {
      matched = false
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
    generateRsvpNotificationEmail({ ...input, matched, matchedBy, emailOnFile }),
    'rsvp_notification',
    guestId
  )
  return { outcome: 'saved', matched }
}
