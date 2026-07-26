import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail, logEmail, COORDINATOR_FROM, NOTIFY_EMAIL } from '@/lib/email'
import { greetingName } from '@/lib/names'
import {
  generateVenueDetailsEmail,
  generateGraciousRegretsEmail,
  generateRsvpYesEmail,
  generateRsvpNoEmail,
  generateRsvpOverCountEmail,
  generateRegistryThankYouEmail,
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
  ]),
  dryRun: z.boolean().optional(),
})

async function loadDetails(): Promise<WeddingDetails> {
  const row = await prisma.setting.findUnique({ where: { key: 'wedding_details' } })
  const fallback: WeddingDetails = { date: 'TBA', time: 'TBA', venueName: 'TBA', venueAddress: '' }
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

  // The thank-you names the actual gift, so it needs the gift on record. Looked up
  // by email, case-insensitively: only the RSVP intake lowercases addresses, while
  // admin-entered guests keep whatever casing was typed.
  type GiftOnFile = { id: string; amount: number; label: string | null }
  const giftsByEmail = new Map<string, GiftOnFile>()
  if (template === 'registry_thank_you') {
    const emails = guests.map((g) => g.email).filter((e): e is string => Boolean(e))
    for (const email of emails) {
      const gift = await prisma.contribution.findFirst({
        where: { contributorEmail: { equals: email, mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' },
        include: { registryItem: { select: { title: true } } },
      })
      if (gift) {
        giftsByEmail.set(email.toLowerCase(), {
          id: gift.id,
          amount: Number(gift.amount),
          // A Stripe gift names its tier; one Nicolle recorded names what it was.
          label: gift.registryItem?.title ?? gift.giftDescription ?? null,
        })
      }
    }
  }

  type GuestRow = {
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
      case 'registry_thank_you': {
        const gift = g.email ? giftsByEmail.get(g.email.toLowerCase()) : undefined
        return generateRegistryThankYouEmail({ name: who, amount: gift?.amount, tierTitle: gift?.label })
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
    const giftOnFile = giftsByEmail.get(guest.email.toLowerCase())
    if (template === 'registry_thank_you' && !giftOnFile) {
      results.push({
        guestId: guest.id,
        email: guest.email,
        success: false,
        error: 'No gift on file — add it on the Gifts tab first',
      })
      continue
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
    // Record that the gift has been thanked so the Gifts tab shows it — best effort,
    // since the note has already gone out and failing the call would misreport that.
    if (res.success && giftOnFile) {
      try {
        await prisma.contribution.update({
          where: { id: giftOnFile.id },
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
