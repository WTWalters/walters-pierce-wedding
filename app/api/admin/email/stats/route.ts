import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Order matters — the tests assert this call sequence.
    const [total, failed, delivered, opened, bounced, complained] = await Promise.all([
      prisma.emailLog.count(),
      prisma.emailLog.count({ where: { status: 'failed' } }),
      prisma.emailLog.count({ where: { OR: [{ status: 'delivered' }, { openedAt: { not: null } }] } }),
      prisma.emailLog.count({ where: { openedAt: { not: null } } }),
      prisma.emailLog.count({ where: { bouncedAt: { not: null } } }),
      prisma.emailLog.count({ where: { status: 'complained' } }),
    ])

    const sent = total - failed
    const openRate = delivered > 0 ? Math.round((opened / delivered) * 100) : 0

    return NextResponse.json({ sent, delivered, opened, openRate, bounced, failed, complained })
  } catch (error) {
    console.error('Error fetching email stats:', error)
    return NextResponse.json({ error: 'Failed to fetch email statistics' }, { status: 500 })
  }
}