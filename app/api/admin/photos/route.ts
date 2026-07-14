import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const photos = await prisma.photo.findMany({
      where: { category: 'guest' },
      orderBy: { createdAt: 'desc' },
      include: {
        likes: { select: { deviceId: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, authorName: true, comment: true, createdAt: true, isHidden: true },
        },
      },
    })
    return NextResponse.json({
      photos: photos.map((p) => ({
        id: p.id,
        uploadedByName: p.uploadedByName,
        caption: p.caption,
        thumbnailUrl: p.thumbnailUrl,
        fileUrl: p.fileUrl,
        createdAt: p.createdAt,
        isHidden: p.isHidden,
        likeCount: p.likes.length,
        comments: p.comments,
      })),
    })
  } catch (error) {
    console.error('Error fetching admin photos:', error)
    return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 })
  }
}
