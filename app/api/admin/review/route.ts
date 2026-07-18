import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AWAITING_REVIEW } from '@/lib/review'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const submissions = await prisma.guest.findMany({
      where: AWAITING_REVIEW,
      orderBy: { rsvpReceivedAt: 'desc' },
      include: { emailLogs: { orderBy: { sentAt: 'desc' }, take: 1 } },
    })
    return NextResponse.json({ submissions, count: submissions.length })
  } catch (error) {
    console.error('Error fetching review queue:', error)
    return NextResponse.json({ error: 'Failed to fetch review queue' }, { status: 500 })
  }
}
