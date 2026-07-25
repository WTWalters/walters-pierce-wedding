import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AWAITING_REVIEW } from '@/lib/review'

const schema = z.object({ targetGuestId: z.string().uuid() })

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

    // The address the guest typed wins, same as name-matching in lib/rsvp.ts —
    // matching here is Nicolle confirming their identity by hand, and the target's
    // address is often a placeholder she invented to satisfy the required+unique
    // Email field. Without this the real address would be destroyed along with the
    // submission row. Identity and reservedSeats on the target are still left
    // untouched: the official record stays authoritative about who was invited.
    const adoptEmail = Boolean(submission.email) && submission.email !== target.email
    const emailReplaced = adoptEmail ? target.email : null

    // Copy the RSVP answer onto the official record and remove the duplicate
    // submission atomically — so a failure can't leave the guest updated but the
    // submission still sitting in the review queue. The delete comes first: email is
    // unique, and the submission row holds the address the target is about to adopt.
    await prisma.$transaction([
      prisma.guest.delete({ where: { id: submission.id } }),
      prisma.guest.update({
        where: { id: target.id },
        data: {
          attending: submission.attending,
          rsvpdCount: submission.rsvpdCount,
          partySize: submission.partySize, // legacy mirror of headcount — kept in sync (see lib/rsvp.ts)
          dietaryRestrictions: submission.dietaryRestrictions,
          songRequest: submission.songRequest,
          rsvpReceivedAt: submission.rsvpReceivedAt,
          ...(adoptEmail ? { email: submission.email } : {}),
        },
      }),
    ])

    if (adoptEmail) {
      // Best-effort record of the replaced address; never fail a completed match
      // over the audit trail.
      try {
        await prisma.auditLog.create({
          data: {
            action: 'match_email_adopted',
            entityType: 'guest',
            entityId: target.id,
            oldValues: { email: emailReplaced },
            newValues: { email: submission.email },
          },
        })
      } catch (err) {
        console.error('Audit of the matched email failed:', err)
      }
    }

    return NextResponse.json({ ok: true, overCap, emailReplaced })
  } catch (error) {
    console.error('Error matching submission:', error)
    return NextResponse.json({ error: 'Failed to match' }, { status: 500 })
  }
}
