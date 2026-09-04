import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildGuestIndex, matchGift } from '@/lib/gift-match'
import { formatPartyName } from '@/lib/guests'
import { NOT_AWAITING_REVIEW } from '@/lib/review'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [rows, tiers, guestRows] = await Promise.all([
    prisma.contribution.findMany({ orderBy: { createdAt: 'desc' }, include: { registryItem: { select: { title: true } } } }),
    prisma.registryItem.findMany({ orderBy: { sortOrder: 'asc' } }),
    // For the form's guest picker, and to show on each row who the gift is credited
    // to. Excludes the To Review queue: those aren't confirmed guests yet.
    prisma.guest.findMany({
      where: NOT_AWAITING_REVIEW,
      select: {
        id: true, firstName: true, lastName: true, email: true,
        partnerFirstName: true, partnerLastName: true, partnerEmail: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
  ])

  // Who each gift is credited to — the explicit link where Nicolle set one, else the
  // email/name fallback. Shown per row so she can SEE the connection that the
  // thank-you send will make, instead of finding out when a send refuses.
  const index = buildGuestIndex(guestRows)
  const guestsById = new Map(guestRows.map((g) => [g.id, g]))

  const contributions = rows.map((c) => {
    const match = matchGift(c, index)
    const matchedGuest = match.guestId ? guestsById.get(match.guestId) : undefined
    return {
    id: c.id,
    contributorName: c.contributorName,
    contributorEmail: c.contributorEmail,
    guestId: c.guestId,
    // null when nothing matched: the Gifts tab shows "not matched" so she can link it.
    matchedGuestId: match.guestId,
    matchedGuestName: matchedGuest ? formatPartyName(matchedGuest) : null,
    matchedBy: match.reason,
    // A Stripe gift names its tier; one Nicolle recorded names what it was.
    tierTitle: c.registryItem?.title ?? c.giftDescription ?? '—',
    // Sent separately from tierTitle so the edit form prefills the raw field she
    // typed rather than the display fallback.
    giftDescription: c.giftDescription,
    amount: Number(c.amount),
    message: c.message,
    paymentStatus: c.paymentStatus,
    thankYouSent: c.thankYouSent,
    source: c.source,
    createdAt: c.createdAt,
    }
  })
  const tierSummary = tiers.map((t) => ({
    id: t.id, title: t.title, category: t.category, sortOrder: t.sortOrder, isActive: t.isActive,
    targetAmount: Number(t.targetAmount), amountRaised: Number(t.amountRaised),
  }))
  const guests = guestRows.map((g) => ({
    id: g.id,
    name: formatPartyName(g),
    email: g.email,
  }))

  return NextResponse.json({ contributions, tiers: tierSummary, guests })
}
