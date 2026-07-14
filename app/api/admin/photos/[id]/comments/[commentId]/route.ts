import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const patchSchema = z.object({ isHidden: z.boolean() })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { commentId } = await params
    const body = await request.json().catch(() => null)
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    await prisma.photoComment.update({ where: { id: commentId }, data: { isHidden: parsed.data.isHidden } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error updating comment:', error)
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { commentId } = await params
    await prisma.photoComment.delete({ where: { id: commentId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting comment:', error)
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 })
  }
}
