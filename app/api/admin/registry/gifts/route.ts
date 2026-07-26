import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Gifts that never touched Stripe — cash, a cheque, a physical present. Nicolle
// records them so the Gifts tab is the whole picture and she can send a thank-you.
//
// Email is optional on purpose: she often won't have one for a cash gift, and making
// it required is what produced the "please-correct@your.emailaddy.com" placeholders on
// the guest list. A gift with no email simply can't be thanked by email.
//
// registryItemId is deliberately never set here. Honeymoon Fund tier progress and the
// public registry page read RegistryItem.amountRaised, so a tier-less gift cannot move
// a public number — her bookkeeping stays out of the guests' view.
const giftSchema = z.object({
  contributorName: z.string().trim().min(1, 'A name is required').max(200),
  contributorEmail: z.string().trim().max(200).optional().default(''),
  giftDescription: z.string().trim().max(500).optional().default(''),
  amount: z.coerce.number().min(0).max(1_000_000),
  // Date only (yyyy-mm-dd) from a date input, or omitted for today.
  givenOn: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = giftSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 }
      )
    }
    const { contributorName, contributorEmail, giftDescription, amount, givenOn } = parsed.data

    const email = contributorEmail.toLowerCase()
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "That email doesn't look right" }, { status: 400 })
    }

    // A bare yyyy-mm-dd parses as UTC midnight, which in Denver is the evening
    // before — noon keeps the date she typed on both sides of the conversion.
    const createdAt = givenOn ? new Date(`${givenOn}T12:00:00`) : new Date()

    const gift = await prisma.contribution.create({
      data: {
        contributorName,
        contributorEmail: email,
        giftDescription: giftDescription || null,
        amount,
        source: 'manual',
        paymentStatus: 'recorded',
        createdAt,
      },
    })

    return NextResponse.json({ ok: true, id: gift.id })
  } catch (error) {
    console.error('Error recording a gift:', error)
    return NextResponse.json({ error: 'Failed to record the gift' }, { status: 500 })
  }
}
