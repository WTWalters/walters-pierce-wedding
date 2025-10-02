import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { invitationCode } = await request.json()

    if (!invitationCode) {
      return NextResponse.json(
        { error: 'Invitation code is required' },
        { status: 400 }
      )
    }

    // Look up guest by invitation code
    const guest = await prisma.guest.findUnique({
      where: {
        invitationCode: invitationCode.trim()
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        attending: true,
        rsvpReceivedAt: true,
        dietaryRestrictions: true,
        specialRequests: true,
        plusOnes: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dietaryRestrictions: true,
            isChild: true,
            age: true
          }
        }
      }
    })

    if (!guest) {
      return NextResponse.json(
        { error: 'Invalid invitation code. Please check your code and try again.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ guest })
  } catch (error) {
    console.error('Error looking up invitation:', error)
    return NextResponse.json(
      { error: 'Failed to lookup invitation' },
      { status: 500 }
    )
  }
}