import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const rows = await prisma.registryItem.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    imageUrl: r.imageUrl,
    category: r.category,
    targetAmount: Number(r.targetAmount),
    amountRaised: Number(r.amountRaised),
  }))
  return NextResponse.json({ items })
}
