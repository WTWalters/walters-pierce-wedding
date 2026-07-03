import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Next.js route files may only export handlers/config — keep this const local.
const WEDDING_DETAILS_KEY = 'wedding_details'

const DEFAULT_DETAILS = {
  date: 'TBA', time: 'TBA', venueName: 'TBA', venueAddress: '',
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const [guests, detailsRow] = await Promise.all([
    prisma.guest.findMany({
      select: {
        id: true, firstName: true, lastName: true, email: true,
        attending: true, partySize: true, dietaryRestrictions: true,
        songRequest: true, source: true, rsvpReceivedAt: true,
        emailLogs: {
          where: { emailType: { in: ['gated_venue_details', 'gated_gracious_regrets'] } },
          select: { emailType: true, status: true, sentAt: true, openedAt: true, bouncedAt: true },
          orderBy: { sentAt: 'desc' },
        },
      },
      orderBy: [{ rsvpReceivedAt: 'desc' }],
    }),
    prisma.setting.findUnique({ where: { key: WEDDING_DETAILS_KEY } }),
  ])
  let details = DEFAULT_DETAILS
  if (detailsRow?.value) {
    try { details = { ...DEFAULT_DETAILS, ...JSON.parse(detailsRow.value) } } catch {}
  }
  return NextResponse.json({ guests, details })
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json()
  const details = {
    date: String(body.date ?? 'TBA'),
    time: String(body.time ?? 'TBA'),
    venueName: String(body.venueName ?? 'TBA'),
    venueAddress: String(body.venueAddress ?? ''),
  }
  await prisma.setting.upsert({
    where: { key: WEDDING_DETAILS_KEY },
    create: {
      key: WEDDING_DETAILS_KEY, value: JSON.stringify(details),
      valueType: 'json', description: 'Date/time/venue revealed only via gated email',
    },
    update: { value: JSON.stringify(details) },
  })
  return NextResponse.json({ ok: true, details })
}
