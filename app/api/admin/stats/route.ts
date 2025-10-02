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

    // Fetch dashboard statistics
    const [
      totalGuests,
      attendingCount,
      notAttendingCount,
      rsvpResponses
    ] = await Promise.all([
      prisma.guest.count(),
      prisma.guest.count({ where: { attending: true } }),
      prisma.guest.count({ where: { attending: false } }),
      prisma.guest.count({ where: { attending: { not: null } } })
    ])

    const stats = {
      totalGuests,
      rsvpResponses,
      attending: attendingCount,
      notAttending: notAttendingCount
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' }, 
      { status: 500 }
    )
  }
}