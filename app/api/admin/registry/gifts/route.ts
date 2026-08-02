import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseGiftRecord } from '@/lib/gift-record'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = parseGiftRecord(await request.json().catch(() => null))
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    // registryItemId is deliberately never set. Honeymoon Fund tier progress and the
    // public registry page read RegistryItem.amountRaised, so a tier-less gift cannot
    // move a public number — her bookkeeping stays out of the guests' view.
    const gift = await prisma.contribution.create({
      data: {
        ...parsed.value,
        createdAt: parsed.value.createdAt ?? new Date(),
        source: 'manual',
        paymentStatus: 'recorded',
      },
    })

    return NextResponse.json({ ok: true, id: gift.id })
  } catch (error) {
    console.error('Error recording a gift:', error)
    return NextResponse.json({ error: 'Failed to record the gift' }, { status: 500 })
  }
}
