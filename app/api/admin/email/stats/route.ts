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

    // The six count() calls stay first and in this order — the tests assert the
    // sequence. `bounced` mirrors the per-row badge's definition (lib/email-status
    // deriveEmailStatus) so the tile and the badges can never disagree. The trailing
    // findMany powers the type-filter dropdown with EVERY type present (not just
    // whatever is currently displayed), independent of the active filter.
    const [total, failed, delivered, opened, bounced, complained, typeRows] = await Promise.all([
      prisma.emailLog.count(),
      prisma.emailLog.count({ where: { status: 'failed' } }),
      prisma.emailLog.count({ where: { OR: [{ status: 'delivered' }, { openedAt: { not: null } }] } }),
      prisma.emailLog.count({ where: { openedAt: { not: null } } }),
      prisma.emailLog.count({ where: { OR: [{ bouncedAt: { not: null } }, { status: 'bounced' }] } }),
      prisma.emailLog.count({ where: { status: 'complained' } }),
      prisma.emailLog.findMany({
        where: { emailType: { not: null } },
        distinct: ['emailType'],
        select: { emailType: true },
        orderBy: { emailType: 'asc' },
      }),
    ])

    const sent = total - failed
    const openRate = delivered > 0 ? Math.round((opened / delivered) * 100) : 0
    const types = typeRows.map((r) => r.emailType).filter((t): t is string => t != null)

    return NextResponse.json({ sent, delivered, opened, openRate, bounced, failed, complained, types })
  } catch (error) {
    console.error('Error fetching email stats:', error)
    return NextResponse.json({ error: 'Failed to fetch email statistics' }, { status: 500 })
  }
}