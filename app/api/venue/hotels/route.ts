import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const hotels = await prisma.hotel.findMany({
      orderBy: [
        { isRecommended: 'desc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json({ hotels })
  } catch (error) {
    console.error('Error fetching hotels:', error)
    return NextResponse.json(
      { error: 'Failed to fetch hotels' },
      { status: 500 }
    )
  }
}