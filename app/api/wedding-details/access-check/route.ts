import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    // Check if there's an RSVP session cookie
    const cookieStore = cookies()
    const rsvpSession = cookieStore.get('rsvp-session')
    
    if (!rsvpSession?.value) {
      return NextResponse.json({
        authorized: false,
        message: 'Please RSVP first to access wedding details'
      })
    }

    // Parse the RSVP session to get guest information
    let sessionData
    try {
      sessionData = JSON.parse(rsvpSession.value)
    } catch (error) {
      return NextResponse.json({
        authorized: false,
        message: 'Invalid RSVP session'
      })
    }

    if (!sessionData.guestId) {
      return NextResponse.json({
        authorized: false,
        message: 'Invalid RSVP session'
      })
    }

    // Fetch the guest from the database
    const guest = await prisma.guest.findUnique({
      where: {
        id: sessionData.guestId
      },
      include: {
        plusOnes: true
      }
    })

    if (!guest) {
      return NextResponse.json({
        authorized: false,
        message: 'Guest not found'
      })
    }

    // Check if guest has RSVP'd "Yes"
    if (guest.attending !== true) {
      return NextResponse.json({
        authorized: false,
        message: 'Wedding details are only available to confirmed attendees. Please RSVP "Yes" to access this page.'
      })
    }

    // Guest is authorized - return their information
    return NextResponse.json({
      authorized: true,
      guest: {
        id: guest.id,
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email,
        invitationCode: guest.invitationCode,
        attending: guest.attending,
        rsvpReceivedAt: guest.rsvpReceivedAt,
        plusOnes: guest.plusOnes.map(po => ({
          firstName: po.firstName,
          lastName: po.lastName
        }))
      }
    })

  } catch (error) {
    console.error('Error checking wedding details access:', error)
    return NextResponse.json(
      {
        authorized: false,
        message: 'Unable to verify access. Please try again.'
      },
      { status: 500 }
    )
  }
}