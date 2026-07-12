import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [attending, notAttending, seatSum] = await Promise.all([
      prisma.guest.count({ where: { attending: true } }),
      prisma.guest.count({ where: { attending: false } }),
      prisma.guest.aggregate({ _sum: { reservedSeats: true } }),
    ])

    const totalInvited = seatSum._sum.reservedSeats ?? 0
    const rsvpReceived = attending + notAttending

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