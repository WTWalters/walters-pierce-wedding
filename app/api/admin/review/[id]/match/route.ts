import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AWAITING_REVIEW } from '@/lib/review'

const schema = z.object({ targetGuestId: z.string().min(1) })

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params

    const submission = await prisma.guest.findFirst({ where: { id, ...AWAITING_REVIEW } })
    if (!submission) {
      return NextResponse.json({ error: 'Not a pending submission' }, { status: 404 })
    }

    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Target must be an official (imported) invited guest — never another submission.
    const target = await prisma.guest.findFirst({
      where: { id: parsed.data.targetGuestId, source: 'imported' },
    })
    if (!target) {
      return NextResponse.json({ error: 'Target is not an invited guest' }, { status: 422 })
    }

    const overCap = target.reservedSeats != null && (submission.rsvpdCount ?? 0) > target.reservedSeats

    // Copy the RSVP answer onto the official record. Identity + email + reservedSeats
    // on the target are left untouched (the official record stays authoritative —
    // same invariant as name-matching in lib/rsvp.ts).
    await prisma.guest.update({
      where: { id: target.id },
      data: {
        attending: submission.attending,
        rsvpdCount: submission.rsvpdCount,
        partySize: submission.partySize,
        dietaryRestrictions: submission.dietaryRestrictions,
        songRequest: submission.songRequest,
        rsvpReceivedAt: submission.rsvpReceivedAt,
      },
    })
    await prisma.guest.delete({ where: { id: submission.id } })

    return NextResponse.json({ ok: true, overCap })
  } catch (error) {
    console.error('Error matching submission:', error)
    return NextResponse.json({ error: 'Failed to match' }, { status: 500 })
  }
}
