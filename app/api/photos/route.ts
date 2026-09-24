import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verifyGuestPhoto, photoUrls } from '@/lib/cloudinary'
import { PAGE_SIZE, parseCursor, cursorFor } from '@/lib/photo-paging'

const createSchema = z.object({
  publicId: z.string().min(1).max(300),
  name: z.string().trim().min(1).max(100),
  caption: z.string().trim().max(280).optional(),
  deviceId: z.string().max(100).optional(),
})

// Paged newest-first; see lib/photo-paging.ts for the cursor.
export async function GET(request: NextRequest) {
  try {
    const params = new URL(request.url).searchParams
    const deviceId = params.get('deviceId') ?? ''
    const rawCursor = params.get('cursor')
    const cursor = rawCursor ? parseCursor(rawCursor) : null
    if (rawCursor && !cursor) {
      return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 })
    }
    const visible: Prisma.PhotoWhereInput = { isHidden: false, category: 'guest' }
    const where: Prisma.PhotoWhereInput = cursor
      ? {
          ...visible,
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        }
      : visible
    // One more than a page, to learn whether there is a next page without a second query.
    const [rows, total] = await Promise.all([
      prisma.photo.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: PAGE_SIZE + 1,
        include: {
          likes: { select: { deviceId: true } },
          comments: {
            where: { isHidden: false },
            orderBy: { createdAt: 'asc' },
            select: { id: true, authorName: true, comment: true, createdAt: true },
          },
        },
      }),
      prisma.photo.count({ where: visible }),
    ])
    const hasMore = rows.length > PAGE_SIZE
    const photos = hasMore ? rows.slice(0, PAGE_SIZE) : rows
    return NextResponse.json({
      nextCursor: hasMore ? cursorFor(photos[photos.length - 1]) : null,
      total,
      photos: photos.map((p) => ({
        id: p.id,
        uploadedByName: p.uploadedByName,
        caption: p.caption,
        fileUrl: p.fileUrl,
        thumbnailUrl: p.thumbnailUrl,
        // The original as an attachment, for "Download". Older rows without a
        // public id fall back to the delivery URL.
        downloadUrl: p.cloudinaryPublicId ? photoUrls(p.cloudinaryPublicId).downloadUrl : p.fileUrl,
        createdAt: p.createdAt,
        likeCount: p.likes.length,
        likedByMe: deviceId !== '' && p.likes.some((l) => l.deviceId === deviceId),
        mine: deviceId !== '' && p.deviceId === deviceId,
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
    const { publicId, name, caption, deviceId } = parsed.data

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
        deviceId: deviceId || null,
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
