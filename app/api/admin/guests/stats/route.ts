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

    // Fetch guest statistics
    const [
      total,
      invited,
      rsvpReceived,
      attending,
      notAttending,
      plusOnes
    ] = await Promise.all([
      // Total guests
      prisma.guest.count(),
      
      // Invited guests (have invitation sent date)
      prisma.guest.count({
        where: {
          invitationSentAt: { not: null }
        }
      }),
      
      // RSVP received
      prisma.guest.count({
        where: {
          rsvpReceivedAt: { not: null }
        }
      }),
      
      // Attending
      prisma.guest.count({
        where: {
          attending: true
        }
      }),
      
      // Not attending
      prisma.guest.count({
        where: {
          attending: false
        }
      }),
      
      // Total plus ones
      prisma.plusOne.count()
    ])

    const noResponse = invited - rsvpReceived

    const stats = {
      total,
      invited,
      rsvpReceived,
      attending,
      notAttending,
      noResponse: Math.max(0, noResponse),
      plusOnes
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching guest stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch guest statistics' },
      { status: 500 }
    )
  }
}