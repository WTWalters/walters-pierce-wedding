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

    // Fetch save-the-date statistics
    const [
      totalGuests,
      emailsSent,
      emailsOpened,
      pendingSend
    ] = await Promise.all([
      // Total guests with email addresses
      prisma.guest.count({
        where: {
          email: { not: '' }
        }
      }),
      
      // Guests who have been sent save-the-dates
      prisma.guest.count({
        where: {
          invitationSentAt: { not: null }
        }
      }),
      
      // Email logs that have been opened
      prisma.emailLog.count({
        where: {
          emailType: 'save_the_date',
          openedAt: { not: null }
        }
      }),
      
      // Guests who haven't received save-the-dates yet (have email and invitation code but no sent date)
      prisma.guest.count({
        where: {
          email: { not: '' },
          invitationCode: { not: null },
          invitationSentAt: null
        }
      })
    ])

    const stats = {
      totalGuests,
      emailsSent,
      emailsOpened,
      pendingSend
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching save-the-date stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' }, 
      { status: 500 }
    )
  }
}