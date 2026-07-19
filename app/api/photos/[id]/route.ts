import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { destroyPhoto } from '@/lib/cloudinary'

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
