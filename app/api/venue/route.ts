import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const venue = await prisma.venue.findFirst({
      where: {
        name: 'Blackstone Rivers Ranch'
      }
    })

    if (!venue) {
      return NextResponse.json(
        { error: 'Venue not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ venue })
  } catch (error) {
    console.error('Error fetching venue:', error)
    return NextResponse.json(
      { error: 'Failed to fetch venue information' },
      { status: 500 }
    )
  }
}