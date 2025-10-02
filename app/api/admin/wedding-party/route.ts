import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all wedding party members
    const weddingParty = await prisma.weddingParty.findMany({
      orderBy: [
        { side: 'asc' },
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json({ weddingParty })
  } catch (error) {
    console.error('Error fetching wedding party:', error)
    return NextResponse.json(
      { error: 'Failed to fetch wedding party' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { name, role, side, bio, relationship, photoUrl, sortOrder, isFeatured } = data

    if (!name || !role || !side) {
      return NextResponse.json(
        { error: 'Name, role, and side are required' },
        { status: 400 }
      )
    }

    // Create new wedding party member
    const weddingPartyMember = await prisma.weddingParty.create({
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
    console.error('Error creating wedding party member:', error)
    return NextResponse.json(
      { error: 'Failed to create wedding party member' },
      { status: 500 }
    )
  }
}