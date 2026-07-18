import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail, logEmail, COORDINATOR_FROM, NOTIFY_EMAIL } from '@/lib/email'
import {
  generateVenueDetailsEmail,
  generateGraciousRegretsEmail,
  generateRsvpYesEmail,
  generateRsvpNoEmail,
  generateRsvpOverCountEmail,
  generateWeddingIcs,
  WeddingDetails,
} from '@/lib/email-templates'

type SendAttachments = Array<{ filename: string; content: string }> | undefined

const sendSchema = z.object({
  guestIds: z.array(z.string().uuid()).min(1).max(100),
  template: z.enum(['venue_details', 'gracious_regrets', 'rsvp_yes', 'rsvp_no', 'rsvp_over_count']),
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

  type GuestRow = { firstName: string; rsvpdCount: number | null; reservedSeats: number | null }
  const render = (g: GuestRow) => {
    switch (template) {
      case 'rsvp_yes': return generateRsvpYesEmail(g.firstName, details)
      case 'rsvp_no': return generateRsvpNoEmail(g.firstName)
      case 'rsvp_over_count': return generateRsvpOverCountEmail(g.firstName, g.rsvpdCount, g.reservedSeats)
      case 'gracious_regrets': return generateGraciousRegretsEmail(g.firstName)
      case 'venue_details':
      default: return generateVenueDetailsEmail(g.firstName, details)
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
    results.push({ guestId: guest.id, email: guest.email, success: res.success, error: res.success ? undefined : res.error })
  }
  return NextResponse.json({ results })
}
