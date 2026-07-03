import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail, logEmail, COORDINATOR_FROM, NOTIFY_EMAIL } from '@/lib/email'
import {
  generateVenueDetailsEmail,
  generateGraciousRegretsEmail,
  WeddingDetails,
} from '@/lib/email-templates'

const sendSchema = z.object({
  guestIds: z.array(z.string().uuid()).min(1).max(100),
  template: z.enum(['venue_details', 'gracious_regrets']),
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

  const render = (firstName: string) =>
    template === 'venue_details'
      ? generateVenueDetailsEmail(firstName, details)
      : generateGraciousRegretsEmail(firstName)

  if (dryRun) {
    const sample = guests[0]
    return NextResponse.json({ preview: render(sample?.firstName ?? ''), recipients: guests.length })
  }

  const results = []
  for (const [i, guest] of guests.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 600))
    const tpl = render(guest.firstName)
    const res = await sendEmail(
      { ...tpl, to: guest.email },
      { from: COORDINATOR_FROM, replyTo: NOTIFY_EMAIL }
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
