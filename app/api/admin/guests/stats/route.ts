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

    const [attendingParties, notAttending, seatSum] = await Promise.all([
      prisma.guest.findMany({
        where: { attending: true, ...NOT_AWAITING_REVIEW },
        select: { rsvpdCount: true, partySize: true },
      }),
      prisma.guest.count({ where: { attending: false, ...NOT_AWAITING_REVIEW } }),
      prisma.guest.aggregate({ _sum: { reservedSeats: true }, where: NOT_AWAITING_REVIEW }),
    ])

    const totalInvited = seatSum._sum.reservedSeats ?? 0
    // "Attending" is a people count for catering: sum each party's headcount.
    // rsvpdCount is canonical; partySize is legacy; an attending party with
    // neither still counts as at least 1 person.
    const attending = attendingParties.reduce(
      (sum, g) => sum + (g.rsvpdCount ?? g.partySize ?? 1),
      0
    )
    // "RSVP Received" is a response count: parties that answered either way.
    const rsvpReceived = attendingParties.length + notAttending

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