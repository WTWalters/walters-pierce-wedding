import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const commentSchema = z.object({
  name: z.string().trim().min(1).max(100),
  comment: z.string().trim().min(1).max(500),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => null)
    const parsed = commentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid comment' }, { status: 400 })
    }
    const photo = await prisma.photo.findFirst({ where: { id, isHidden: false } })
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }
    const created = await prisma.photoComment.create({
      data: {
        photoId: id,
        authorName: parsed.data.name,
        comment: parsed.data.comment,
        // legacy pre-gating flag; comments are live unless isHidden
        isApproved: true,
      },
    })
    return NextResponse.json({
      comment: {
        id: created.id,
        authorName: created.authorName,
        comment: created.comment,
        createdAt: created.createdAt,
      },
    })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
  }
}
