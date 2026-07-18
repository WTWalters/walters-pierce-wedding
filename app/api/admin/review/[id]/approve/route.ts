import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AWAITING_REVIEW } from '@/lib/review'

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
    await prisma.guest.update({
      where: { id },
      data: {
        reviewedAt: new Date(),
        reviewedBy: session.user.email ?? null,
        // Backfill the seat allocation so the approved party is reflected in
        // Total Invited (self_rsvp rows arrive with reservedSeats = null).
        reservedSeats: submission.reservedSeats ?? submission.rsvpdCount ?? null,
      },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error approving submission:', error)
    return NextResponse.json({ error: 'Failed to approve' }, { status: 500 })
  }
}
