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

    // Fetch email statistics
    const [
      totalSent,
      delivered,
      opened,
      failed
    ] = await Promise.all([
      prisma.emailLog.count(),
      prisma.emailLog.count({ where: { status: 'sent' } }),
      prisma.emailLog.count({ where: { openedAt: { not: null } } }),
      prisma.emailLog.count({ where: { status: 'failed' } })
    ])

    const stats = {
      totalSent,
      delivered,
      opened,
      failed
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching email stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email statistics' }, 
      { status: 500 }
    )
  }
}