import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EMAILS_TAB_EXCLUDED_TYPES } from '@/lib/email-status'

const CAP = 500

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Hide the non-guest-facing noise (STD + internal coordinator notifications). A
    // specific ?type= is always one of the allowed guest-facing types (the dropdown
    // only offers those), so it needs no extra guard.
    const type = new URL(request.url).searchParams.get('type')
    const where = type
      ? { emailType: type }
      : { emailType: { notIn: EMAILS_TAB_EXCLUDED_TYPES } }

    const [rows, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take: CAP,
        select: {
          id: true, recipientEmail: true, emailType: true, subject: true,
          sentAt: true, status: true, openedAt: true, bouncedAt: true, clickedAt: true,
          guest: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.emailLog.count({ where }),
    ])

    const emails = rows.map((r) => ({
      id: r.id,
      recipientEmail: r.recipientEmail,
      emailType: r.emailType,
      subject: r.subject,
      sentAt: r.sentAt,
      status: r.status,
      openedAt: r.openedAt,
      bouncedAt: r.bouncedAt,
      clickedAt: r.clickedAt,
      guestName: r.guest ? `${r.guest.firstName} ${r.guest.lastName}`.trim() : null,
    }))

    return NextResponse.json({ emails, total, capped: total > CAP })
  } catch (error) {
    console.error('Error fetching emails:', error)
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 })
  }
}
