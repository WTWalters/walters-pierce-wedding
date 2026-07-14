import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const likeSchema = z.object({ deviceId: z.string().min(8).max(64) })

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => null)
    const parsed = likeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const { deviceId } = parsed.data

    const photo = await prisma.photo.findFirst({ where: { id, isHidden: false } })
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    let liked: boolean
    try {
      await prisma.photoLike.create({ data: { photoId: id, deviceId } })
      liked = true
    } catch (error) {
      // Unique (photoId, deviceId) violation = this device already liked → toggle off
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        await prisma.photoLike.deleteMany({ where: { photoId: id, deviceId } })
        liked = false
      } else {
        throw error
      }
    }
    const likeCount = await prisma.photoLike.count({ where: { photoId: id } })
    return NextResponse.json({ liked, likeCount })
  } catch (error) {
    console.error('Error toggling like:', error)
    return NextResponse.json({ error: 'Failed to update like' }, { status: 500 })
  }
}
