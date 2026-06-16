import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Throttle to make invitation-code brute force / enumeration impractical.
    const { allowed } = rateLimit(`rsvp-lookup:${clientIp(request)}`, 10, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a minute and try again.' },
        { status: 429 }
      )
    }

    const { invitationCode } = await request.json()

    if (!invitationCode || !invitationCode.trim()) {
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