import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { isCloudinaryConfigured, zipDownloadUrl, ZIP_LIMIT } from '@/lib/cloudinary'
import { checkRateLimit } from '@/lib/rate-limit'

// Several chosen photos as one zip. The browser sends the ids it picked; this looks
// up their Cloudinary public ids — only photos that are actually on the gallery —
// and hands back a signed URL that Cloudinary builds the archive at. A single
// photo never comes here: its own attachment URL is a plain link.
const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(ZIP_LIMIT) })

export async function POST(request: NextRequest) {
  try {
    if (!isCloudinaryConfigured()) {
      return NextResponse.json({ error: 'Downloads are not available yet' }, { status: 503 })
    }
    // Last x-forwarded-for hop, as in the sign route: Railway appends the real
    // client IP and the leftmost entries are client-controllable.
    const ip = request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'unknown'
    // Every zip is delivered at full size, so this bounds what one address can
    // cost in bandwidth in an hour; a whole household on one IP still gets plenty.
    if (!checkRateLimit(`photo-zip:${ip}`, 20, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'That’s a lot of downloads at once — please try again in a little while' },
        { status: 429 }
      )
    }
    const body = await request.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const photos = await prisma.photo.findMany({
      where: {
        id: { in: parsed.data.ids },
        isHidden: false,
        category: 'guest',
        cloudinaryPublicId: { not: null },
      },
      select: { cloudinaryPublicId: true },
    })
    const publicIds = photos
      .map((p) => p.cloudinaryPublicId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
    if (publicIds.length === 0) {
      return NextResponse.json({ error: 'No photos to download' }, { status: 404 })
    }
    return NextResponse.json({ url: zipDownloadUrl(publicIds), count: publicIds.length })
  } catch (error) {
    console.error('Error preparing photo download:', error)
    return NextResponse.json({ error: 'Failed to prepare download' }, { status: 500 })
  }
}
