import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail, logEmail, COORDINATOR_FROM, NOTIFY_EMAIL } from '@/lib/email'
import { greetingName } from '@/lib/names'
import { matchGiftsToGuests } from '@/lib/gift-match'
import { daysUntilDeadline, DEFAULT_RSVP_DEADLINE } from '@/lib/rsvp-deadline'
import {
  generateVenueDetailsEmail,
  generateGraciousRegretsEmail,
  generateRsvpYesEmail,
  generateRsvpNoEmail,
  generateRsvpOverCountEmail,
  generateRegistryThankYouEmail,
  generateRsvpReminderEmail,
  generateWeddingIcs,
  WeddingDetails,
} from '@/lib/email-templates'

type SendAttachments = Array<{ filename: string; content: string }> | undefined

const sendSchema = z.object({
  guestIds: z.array(z.string().uuid()).min(1).max(100),
  template: z.enum([
    'venue_details',
    'gracious_regrets',
    'rsvp_yes',
    'rsvp_no',
    'rsvp_over_count',
    'registry_thank_you',
    'rsvp_reminder',
  ]),
  dryRun: z.boolean().optional(),
})

async function loadDetails(): Promise<WeddingDetails> {
  const row = await prisma.setting.findUnique({ where: { key: 'wedding_details' } })
  const fallback: WeddingDetails = {
    date: 'TBA', time: 'TBA', venueName: 'TBA', venueAddress: '',
    rsvpDeadline: DEFAULT_RSVP_DEADLINE,
  }
  if (!row?.value) return fallback
  try { return { ...fallback, ...JSON.parse(row.value) } } catch { return fallback }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const parsed = sendSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const { guestIds, template, dryRun } = parsed.data

  const guests = await prisma.guest.findMany({ where: { id: { in: guestIds } } })
  const details = await loadDetails()

  // The thank-you names the actual gifts, so it needs them on record. ALL of them:
  // Aunt Marilyn gave a cake serving set and cash, and Nicolle wants one note
  // acknowledging both. Recording each gift separately keeps the ledger honest and
  // lets the note scale past two without a "second gift" field.
  //
  // This used to look gifts up by email alone, which is what produced Nicolle's
  // "there's no gift recorded" on gifts she had plainly just added: a hand-recorded
  // gift often has no email at all, and a Stripe one carries whatever address was
  // typed at checkout. lib/gift-match resolves a gift to its guest by the explicit
  // link first, then email, then name.
  type GiftOnFile = { id: string; amount: number; label: string | null }
  const giftsByGuestId = new Map<string, GiftOnFile[]>()
  if (template === 'registry_thank_you') {
    const allGifts = await prisma.contribution.findMany({
      // Oldest first, so the sentence lists them in the order they arrived.
      orderBy: { createdAt: 'asc' },
      include: { registryItem: { select: { title: true } } },
    })
    for (const [guestId, gifts] of matchGiftsToGuests(allGifts, guests)) {
      giftsByGuestId.set(
        guestId,
        gifts.map((gift) => ({
          id: gift.id,
          amount: Number(gift.amount),
          // A Stripe gift names its tier; one Nicolle recorded names what it was.
          label: gift.registryItem?.title ?? gift.giftDescription ?? null,
        }))
      )
    }
  }

  // Days left to reply, counted once for the whole batch so every note in one send
  // quotes the same number. Null means the saved deadline isn't a usable date.
  const deadline = details.rsvpDeadline || DEFAULT_RSVP_DEADLINE
  const daysLeft = daysUntilDeadline(deadline)

  type GuestRow = {
    id?: string
    firstName: string
    preferredName?: string | null
    rsvpdCount: number | null
    reservedSeats: number | null
    email?: string | null
  }
  const render = (g: GuestRow) => {
    // One resolved greeting for every template — honors the per-guest override.
    const who = greetingName(g)
    switch (template) {
      case 'rsvp_yes': return generateRsvpYesEmail(who, details, g.rsvpdCount)
      case 'rsvp_no': return generateRsvpNoEmail(who)
      case 'rsvp_over_count': return generateRsvpOverCountEmail(who, g.rsvpdCount, g.reservedSeats)
      case 'gracious_regrets': return generateGraciousRegretsEmail(who)
      case 'rsvp_reminder': return generateRsvpReminderEmail(who, daysLeft ?? 0, deadline)
      case 'registry_thank_you': {
        const gifts = (g.id ? giftsByGuestId.get(g.id) : undefined) ?? []
        return generateRegistryThankYouEmail({
          name: who,
          gifts: gifts.map((gift) => ({ amount: gift.amount, label: gift.label })),
        })
      }
      case 'venue_details':
      default: return generateVenueDetailsEmail(who, details)
    }
  }

  if (dryRun) {
    const sample = guests[0]
    return NextResponse.json({ preview: render(sample ?? { firstName: '', rsvpdCount: null, reservedSeats: null }), recipients: guests.length })
  }

  // Venue-details and RSVP-yes emails carry the calendar invite; it exists
  // nowhere on the public site. Skipped automatically while details are TBA/unparseable.
  let attachments: SendAttachments
  if (template === 'venue_details' || template === 'rsvp_yes') {
    const ics = generateWeddingIcs(details)
    if (ics) {
      attachments = [
        { filename: 'Emme-Connor-Wedding.ics', content: Buffer.from(ics).toString('base64') },
      ]
    }
  }

  const results = []
  for (const [i, guest] of guests.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 600))
    // Guest Management guests are email-optional; skip rather than fire a
    // guaranteed-failed Resend send to an empty address.
    if (!guest.email) {
      results.push({ guestId: guest.id, email: null, success: false, error: 'No email on file' })
      continue
    }
    // Refuse rather than send a thank-you that can't name the gift. Recording the
    // gift on the Gifts tab first is the intended order, and a vague note to
    // someone who gave generously is worse than no note.
    const giftsOnFile = giftsByGuestId.get(guest.id)
    if (template === 'registry_thank_you' && !giftsOnFile) {
      results.push({
        guestId: guest.id,
        email: guest.email,
        success: false,
        error: 'No gift on file — add it on the Gifts tab first',
      })
      continue
    }
    if (template === 'rsvp_reminder') {
      // "You have X days to reply" only makes sense while there are days left, and
      // a mistyped deadline gives no number at all. Refusing beats sending a note
      // that says "-2 days" or "NaN days" to a hundred people.
      if (daysLeft === null) {
        results.push({
          guestId: guest.id, email: guest.email, success: false,
          error: 'The RSVP deadline isn’t a valid date — fix it before sending',
        })
        continue
      }
      if (daysLeft < 0) {
        results.push({
          guestId: guest.id, email: guest.email, success: false,
          error: 'The RSVP deadline has passed — move it before sending a reminder',
        })
        continue
      }
      // This is the "RSVP - unknown" note by definition. Someone who has already
      // answered would read "reply before you're listed as no" as us losing their RSVP.
      if (guest.attending !== null) {
        results.push({
          guestId: guest.id, email: guest.email, success: false,
          error: 'They have already replied — this reminder is only for guests with no answer',
        })
        continue
      }
    }
    const tpl = render(guest)
    const res = await sendEmail(
      { ...tpl, to: guest.email },
      { from: COORDINATOR_FROM, replyTo: NOTIFY_EMAIL, attachments }
    )
    await logEmail({
      guestId: guest.id,
      emailType: `gated_${template}`,
      recipientEmail: guest.email,
      subject: tpl.subject,
      status: res.success ? 'sent' : 'failed',
      resendMessageId: res.success ? res.messageId : null,
    })
    // Mark every gift the note acknowledged, not just one, or the Gifts tab would
    // show a thanked serving set beside an unthanked cheque from the same note.
    // Best effort: the note has already gone out, so failing here would misreport it.
    if (res.success && giftsOnFile) {
      try {
        await prisma.contribution.updateMany({
          where: { id: { in: giftsOnFile.map((g) => g.id) } },
          data: { thankYouSent: true, thankYouSentAt: new Date() },
        })
      } catch (err) {
        console.error('Marking the thank-you as sent failed:', err)
      }
    }
    results.push({ guestId: guest.id, email: guest.email, success: res.success, error: res.success ? undefined : res.error })
  }
  return NextResponse.json({ results })
}
