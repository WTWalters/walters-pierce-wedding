import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verifyGuestPhoto, photoUrls } from '@/lib/cloudinary'

const createSchema = z.object({
  publicId: z.string().min(1).max(300),
  name: z.string().trim().min(1).max(100),
  caption: z.string().trim().max(280).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const deviceId = new URL(request.url).searchParams.get('deviceId') ?? ''
    const photos = await prisma.photo.findMany({
      where: { isHidden: false, category: 'guest' },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        likes: { select: { deviceId: true } },
        comments: {
          where: { isHidden: false },
          orderBy: { createdAt: 'asc' },
          select: { id: true, authorName: true, comment: true, createdAt: true },
        },
      },
    })
    return NextResponse.json({
      photos: photos.map((p) => ({
        id: p.id,
        uploadedByName: p.uploadedByName,
        caption: p.caption,
        fileUrl: p.fileUrl,
        thumbnailUrl: p.thumbnailUrl,
        createdAt: p.createdAt,
        likeCount: p.likes.length,
        likedByMe: deviceId !== '' && p.likes.some((l) => l.deviceId === deviceId),
        comments: p.comments,
      })),
    })
  } catch (error) {
    console.error('Error fetching photos:', error)
    return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid photo details' }, { status: 400 })
    }
    const { publicId, name, caption } = parsed.data

    const verified = await verifyGuestPhoto(publicId)
    if (!verified) {
      return NextResponse.json({ error: 'Upload could not be verified' }, { status: 422 })
    }
    const existing = await prisma.photo.findFirst({ where: { cloudinaryPublicId: publicId } })
    if (existing) {
      return NextResponse.json({ error: 'Photo already added' }, { status: 409 })
    }
    const urls = photoUrls(publicId)
    const photo = await prisma.photo.create({
      data: {
        category: 'guest',
        uploadedByName: name,
        caption: caption || null,
        cloudinaryPublicId: publicId,
        fileUrl: urls.fileUrl,
        thumbnailUrl: urls.thumbnailUrl,
        // isApproved is legacy pre-gating machinery; photos are live unless
        // isHidden. Set true so any old isApproved-filtered query still works.
        isApproved: true,
      },
    })
    return NextResponse.json({ ok: true, id: photo.id })
  } catch (error) {
    // The findFirst check above is only a fast path — two concurrent POSTs
    // can both pass it. The unique index on cloudinaryPublicId makes the
    // loser's create throw P2002; report it as the same duplicate outcome.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Photo already added' }, { status: 409 })
    }
    console.error('Error creating photo:', error)
    return NextResponse.json({ error: 'Failed to save photo' }, { status: 500 })
  }
}
