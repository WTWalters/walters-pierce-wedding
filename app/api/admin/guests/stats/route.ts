import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NOT_AWAITING_REVIEW } from '@/lib/review'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [attendingParties, decliningParties, seatSum] = await Promise.all([
      prisma.guest.findMany({
        where: { attending: true, ...NOT_AWAITING_REVIEW },
        select: { rsvpdCount: true, partySize: true, reservedSeats: true },
      }),
      prisma.guest.findMany({
        where: { attending: false, ...NOT_AWAITING_REVIEW },
        select: { reservedSeats: true },
      }),
      prisma.guest.aggregate({ _sum: { reservedSeats: true }, where: NOT_AWAITING_REVIEW }),
    ])

    const totalInvited = seatSum._sum.reservedSeats ?? 0
    // rsvpdCount is canonical; partySize is legacy; an attending party with
    // neither still counts as at least 1 person.
    const headcount = (g: { rsvpdCount: number | null; partySize: number | null }) =>
      g.rsvpdCount ?? g.partySize ?? 1

    // "Attending" is a people count for catering: sum each party's headcount.
    const attending = attendingParties.reduce((sum, g) => sum + headcount(g), 0)

    // "RSVP Received" is a response count: PARTIES that answered either way. It is
    // deliberately not derived from notAttending, which counts people — mixing the
    // two units here is exactly the kind of quiet arithmetic error that survives
    // review because both numbers still look plausible.
    const rsvpReceived = attendingParties.length + decliningParties.length

    // "Not Attending" is a people count too, so it lines up with Attending and
    // Total Guests Invited. Nicolle's formula (Reserved - Claimed = Not Attending):
    // a declining party gives up its whole reservation, and an attending party that
    // RSVP'd for fewer than it held leaves the difference empty.
    const declinedSeats = decliningParties.reduce(
      // No reservation on file still means one person declined — themselves.
      (sum, g) => sum + (g.reservedSeats ?? 1),
      0
    )
    const unclaimedSeats = attendingParties.reduce((sum, g) => {
      const claimed = headcount(g)
      // With no reservation recorded there's no known shortfall, so treat the
      // reservation as exactly what they claimed rather than inventing a gap.
      const reserved = g.reservedSeats ?? claimed
      // An over-cap RSVP must not subtract from the total.
      return sum + Math.max(0, reserved - claimed)
    }, 0)
    const notAttending = declinedSeats + unclaimedSeats

    const stats = { totalInvited, rsvpReceived, attending, notAttending }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching guest stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch guest statistics' },
      { status: 500 }
    )
  }
}