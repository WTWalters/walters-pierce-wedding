import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json()
  const data: Record<string, unknown> = {}
  if (typeof body.title === 'string') data.title = body.title
  if (typeof body.description === 'string') data.description = body.description
  if (body.targetAmount != null && body.targetAmount !== '') data.targetAmount = Number(body.targetAmount)
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive
  if (body.sortOrder != null && body.sortOrder !== '') data.sortOrder = parseInt(body.sortOrder)
  if (typeof body.imageUrl === 'string') data.imageUrl = body.imageUrl || null

  const updated = await prisma.registryItem.update({ where: { id }, data })
  return NextResponse.json({ success: true, item: { ...updated, targetAmount: Number(updated.targetAmount), amountRaised: Number(updated.amountRaised) } })
}
