import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const data = await request.json()
    const { name, role, side, bio, relationship, photoUrl, sortOrder, isFeatured } = data

    if (!name || !role || !side) {
      return NextResponse.json(
        { error: 'Name, role, and side are required' },
        { status: 400 }
      )
    }

    // Update wedding party member
    const weddingPartyMember = await prisma.weddingParty.update({
      where: { id },
      data: {
        name,
        role,
        side,
        bio: bio || null,
        relationship: relationship || null,
        photoUrl: photoUrl || null,
        sortOrder: sortOrder || 0,
        isFeatured: isFeatured || false
      }
    })

    return NextResponse.json({
      success: true,
      weddingPartyMember
    })
  } catch (error) {
    console.error('Error updating wedding party member:', error)
    return NextResponse.json(
      { error: 'Failed to update wedding party member' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Delete wedding party member
    await prisma.weddingParty.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Wedding party member deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting wedding party member:', error)
    return NextResponse.json(
      { error: 'Failed to delete wedding party member' },
      { status: 500 }
    )
  }
}