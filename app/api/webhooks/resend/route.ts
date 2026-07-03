import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { prisma } from '@/lib/prisma'

// Resend signs webhooks with svix. Configure the endpoint + secret at
// https://resend.com/webhooks and set RESEND_WEBHOOK_SECRET in Railway.
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }
  const payload = await request.text()
  const headers = {
    'svix-id': request.headers.get('svix-id') ?? '',
    'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
    'svix-signature': request.headers.get('svix-signature') ?? '',
  }
  let event: { type: string; data: { email_id?: string } }
  try {
    event = new Webhook(secret).verify(payload, headers) as typeof event
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const messageId = event.data?.email_id
  if (messageId) {
    if (event.type === 'email.opened') {
      await prisma.emailLog.updateMany({
        where: { resendMessageId: messageId, openedAt: null },
        data: { openedAt: new Date() },
      })
    } else if (event.type === 'email.bounced') {
      await prisma.emailLog.updateMany({
        where: { resendMessageId: messageId },
        data: { bouncedAt: new Date(), status: 'bounced' },
      })
    } else if (event.type === 'email.delivered') {
      await prisma.emailLog.updateMany({
        where: { resendMessageId: messageId, status: 'sent' },
        data: { status: 'delivered' },
      })
    }
  }
  return NextResponse.json({ received: true })
}
