import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { sendEmail, logEmail, EMME_CONNOR_FROM, GIFT_NOTIFY_EMAILS } from '@/lib/email'
import { generateRegistryThankYouEmail, generateGiftNotificationEmail } from '@/lib/email-templates'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })

  const raw = await request.text()
  const sig = request.headers.get('stripe-signature') ?? ''

  let event
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as {
      payment_intent: string | null
      amount_total: number | null
      customer_details: { email: string | null } | null
      metadata: Record<string, string> | null
    }
    const paymentIntentId = typeof s.payment_intent === 'string' ? s.payment_intent : null
    const registryItemId = s.metadata?.registryItemId ?? null
    if (paymentIntentId && registryItemId) {
      const already = await prisma.contribution.findUnique({ where: { stripePaymentIntentId: paymentIntentId } })
      if (!already) {
        const amount = (s.amount_total ?? 0) / 100
        const name = s.metadata?.contributorName ?? 'A friend'
        const email = s.customer_details?.email ?? ''
        try {
          // Capture the charge id for reconciliation/refunds (best-effort; the
          // payment_intent is the durable key, so a failed retrieve is non-fatal).
          let stripeChargeId: string | null = null
          try {
            const pi = await getStripe().paymentIntents.retrieve(paymentIntentId)
            stripeChargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : null
          } catch { /* leave null */ }

          const contribution = await prisma.contribution.create({
            data: {
              registryItemId,
              contributorName: name,
              contributorEmail: email,
              amount,
              message: s.metadata?.contributorMessage || null,
              stripePaymentIntentId: paymentIntentId,
              stripeChargeId,
              paymentStatus: 'paid',
              // thankYouSent stays false until the receipt actually sends (below).
            },
          })
          await prisma.registryItem.update({ where: { id: registryItemId }, data: { amountRaised: { increment: amount } } })

          const item = await prisma.registryItem.findUnique({ where: { id: registryItemId } })

          // Heads-up to the coordinator for every gift (thank-you tracking), whether or
          // not the giver left an email for a receipt.
          const notif = generateGiftNotificationEmail({
            name, amount, tierTitle: item?.title ?? 'the Honeymoon Fund',
            message: s.metadata?.contributorMessage || null,
          })
          const notifRes = await sendEmail({ to: GIFT_NOTIFY_EMAILS, ...notif }, { from: EMME_CONNOR_FROM })
          await logEmail({
            emailType: 'gift_notification', recipientEmail: GIFT_NOTIFY_EMAILS.join(', '), subject: notif.subject,
            status: notifRes.success ? 'sent' : 'failed', resendMessageId: notifRes.success ? notifRes.messageId : null,
          })

          if (email) {
            const tmpl = generateRegistryThankYouEmail({ name, tierTitle: item?.title ?? 'your gift', amount })
            const res = await sendEmail({ to: email, ...tmpl }, { from: EMME_CONNOR_FROM })
            await logEmail({
              emailType: 'registry_thank_you', recipientEmail: email, subject: tmpl.subject,
              status: res.success ? 'sent' : 'failed', resendMessageId: res.success ? res.messageId : null,
            })
            // Only mark thanked when the receipt genuinely went out — this flag drives
            // the admin "who still needs a thank-you card" report.
            if (res.success) {
              await prisma.contribution.update({
                where: { id: contribution.id },
                data: { thankYouSent: true, thankYouSentAt: new Date() },
              })
            }
          }
        } catch (err) {
          console.error('Registry webhook processing failed:', err)
        }
      }
    }
  }

  return NextResponse.json({ received: true })
}
