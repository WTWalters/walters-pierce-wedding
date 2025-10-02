import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Fetch all wedding party members
    const weddingParty = await prisma.weddingParty.findMany({
      orderBy: [
        { side: 'asc' },
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    })

    // Separate by side
    const bridesSide = weddingParty.filter(member => member.side === 'bride')
    const groomsSide = weddingParty.filter(member => member.side === 'groom')

    return NextResponse.json({
      bridesSide,
      groomsSide,
      total: weddingParty.length
    })
  } catch (error) {
    console.error('Error fetching wedding party:', error)
    return NextResponse.json(
      { error: 'Failed to fetch wedding party information' },
      { status: 500 }
    )
  }
}