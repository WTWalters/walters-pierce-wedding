import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'
import { resolveChargeCents } from '@/lib/registry'

const schema = z.object({
  registryItemId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  message: z.string().trim().max(500).optional(),
  amount: z.number().positive().optional(),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid submission' }, { status: 400 })
  }
  const { registryItemId, name, message, amount } = parsed.data

  const item = await prisma.registryItem.findFirst({ where: { id: registryItemId, isActive: true } })
  if (!item) return NextResponse.json({ error: 'That gift is not available.' }, { status: 404 })

  const charge = resolveChargeCents({ category: item.category, targetAmount: Number(item.targetAmount) }, amount)
  if (!charge.ok) return NextResponse.json({ error: charge.message }, { status: 400 })

  const origin = new URL(request.url).origin
  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      quantity: 1,
      price_data: { currency: 'usd', unit_amount: charge.cents, product_data: { name: item.title } },
    }],
    metadata: { registryItemId, contributorName: name, contributorMessage: message ?? '' },
    success_url: `${origin}/registry/thank-you`,
    cancel_url: `${origin}/registry`,
  })

  return NextResponse.json({ url: session.url })
}
