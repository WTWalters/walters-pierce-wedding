import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseGiftRecords } from '@/lib/gift-record'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // One submission can describe two gifts from the same person.
    const parsed = parseGiftRecords(await request.json().catch(() => null))
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    // registryItemId is deliberately never set. Honeymoon Fund tier progress and the
    // public registry page read RegistryItem.amountRaised, so a tier-less gift cannot
    // move a public number — her bookkeeping stays out of the guests' view.
    //
    // Both gifts in one transaction: recording the serving set but losing the $100 to
    // an error would send a thank-you that names half of what she gave.
    const gifts = await prisma.$transaction(
      parsed.value.map((gift) =>
        prisma.contribution.create({
          data: {
            ...gift,
            createdAt: gift.createdAt ?? new Date(),
            source: 'manual',
            paymentStatus: 'recorded',
          },
        })
      )
    )

    return NextResponse.json({ ok: true, id: gifts[0].id, ids: gifts.map((g) => g.id) })
  } catch (error) {
    console.error('Error recording a gift:', error)
    return NextResponse.json({ error: 'Failed to record the gift' }, { status: 500 })
  }
}
