import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { destroyPhoto } from '@/lib/cloudinary'

const patchSchema = z.object({ isHidden: z.boolean() })

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const body = await request.json().catch(() => null)
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const photo = await prisma.photo.update({ where: { id }, data: { isHidden: parsed.data.isHidden } })
    return NextResponse.json({ ok: true, isHidden: photo.isHidden })
  } catch (error) {
    console.error('Error updating photo:', error)
    return NextResponse.json({ error: 'Failed to update photo' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const photo = await prisma.photo.findUnique({ where: { id } })
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
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
