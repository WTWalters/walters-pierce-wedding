import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [rows, tiers] = await Promise.all([
    prisma.contribution.findMany({ orderBy: { createdAt: 'desc' }, include: { registryItem: { select: { title: true } } } }),
    prisma.registryItem.findMany({ orderBy: { sortOrder: 'asc' } }),
  ])

  const contributions = rows.map((c) => ({
    id: c.id,
    contributorName: c.contributorName,
    contributorEmail: c.contributorEmail,
    tierTitle: c.registryItem?.title ?? '—',
    amount: Number(c.amount),
    message: c.message,
    paymentStatus: c.paymentStatus,
    thankYouSent: c.thankYouSent,
    createdAt: c.createdAt,
  }))
  const tierSummary = tiers.map((t) => ({
    id: t.id, title: t.title, category: t.category, sortOrder: t.sortOrder, isActive: t.isActive,
    targetAmount: Number(t.targetAmount), amountRaised: Number(t.amountRaised),
  }))

  return NextResponse.json({ contributions, tiers: tierSummary })
}
