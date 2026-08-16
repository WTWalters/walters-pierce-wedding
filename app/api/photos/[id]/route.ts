import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { destroyPhoto } from '@/lib/cloudinary'

// 280 matches the limit the upload route already declared for a caption. deviceId
// travels in the body, not the query, so this capability token stays out of access
// logs — the same convention as DELETE and the like endpoint.
const captionSchema = z.object({
  caption: z.string().max(280).default(''),
  deviceId: z.string().default(''),
})

// Caption a photo, or change the caption already on it.
//
// Nothing ever set a caption before this: the upload only recorded who shared the
// photo, so every row carried caption: null while both galleries were already ready
// to show one. Captioning after the fact rather than during upload is deliberate —
// guests share ten photos at a time from a phone at a reception, and ten prompts in
// a row is how you get no captions at all.
//
// Same two authorization paths as DELETE below: an admin session (so Nicolle can fix
// or remove anything) OR a deviceId matching the uploader's token (so a guest can
// caption their own).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => null)
    const parsed = captionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'A caption can be at most 280 characters' },
        { status: 400 }
      )
    }
    const { caption, deviceId } = parsed.data

    const photo = await prisma.photo.findFirst({ where: { id, category: 'guest' } })
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    const session = await getServerSession(authOptions)
    const isAdmin = session?.user?.role === 'admin'
    const isOwner = photo.deviceId != null && deviceId !== '' && photo.deviceId === deviceId
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    // Cleared back to null rather than stored as '', so "has a caption" stays a
    // single test everywhere it's read.
    const next = caption.trim() || null
    await prisma.photo.update({ where: { id }, data: { caption: next } })
    return NextResponse.json({ ok: true, caption: next })
  } catch (error) {
    console.error('Error captioning photo:', error)
    return NextResponse.json({ error: 'Failed to save the caption' }, { status: 500 })
  }
}

// Two authorization paths: a valid admin session (Emme/Connor/Nicolle → delete
// any) OR a deviceId that matches the photo's uploader token (guest → delete own).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    // deviceId travels in the body (not the query) so this delete-capability
    // token stays out of access logs — matching the like endpoint's convention.
    const body = await request.json().catch(() => null)
    const deviceId = typeof body?.deviceId === 'string' ? body.deviceId : ''

    const photo = await prisma.photo.findFirst({ where: { id, category: 'guest' } })
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    const session = await getServerSession(authOptions)
    const isAdmin = session?.user?.role === 'admin'
    const isOwner = photo.deviceId != null && deviceId !== '' && photo.deviceId === deviceId

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    if (photo.cloudinaryPublicId) {
      await destroyPhoto(photo.cloudinaryPublicId)
    }
    await prisma.photo.delete({ where: { id } }) // cascades comments + likes
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting photo:', error)
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 })
  }
}
