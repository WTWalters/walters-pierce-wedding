import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertSeatCap } from '@/lib/guests'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all guests with their plus ones
    const guests = await prisma.guest.findMany({
      include: {
        plusOnes: true
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    })

    return NextResponse.json({ guests })
  } catch (error) {
    console.error('Error fetching guests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch guests' },
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
    const { firstName, lastName, email, phone, addressLine1, addressLine2, city, state, zipCode, notes,
            partnerFirstName, partnerLastName, partnerEmail, reservedSeats: rawSeats, rsvpdCount: rawRsvpd, songRequest } = data
    const reservedSeats = rawSeats != null && rawSeats !== '' ? parseInt(rawSeats) : null
    const rsvpdCount = rawRsvpd != null && rawRsvpd !== '' ? parseInt(rawRsvpd) : null
    const cap = assertSeatCap({ reservedSeats, rsvpdCount })
    if (!cap.ok) {
      return NextResponse.json({ error: cap.message }, { status: 400 })
    }

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'First name and last name are required' },
        { status: 400 }
      )
    }

    // Email is optional (postal-only invites). Only enforce uniqueness when given.
    const normalizedEmail = email && email.trim() ? email.trim() : null
    if (normalizedEmail) {
      const existingGuest = await prisma.guest.findUnique({
        where: { email: normalizedEmail }
      })
      if (existingGuest) {
        return NextResponse.json(
          { error: 'A guest with this email already exists' },
          { status: 400 }
        )
      }
    }

    // Create new guest
    const guest = await prisma.guest.create({
      data: {
        firstName,
        lastName,
        email: normalizedEmail,
        phone: phone || null,
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        notes: notes || null,
        partnerFirstName: partnerFirstName || null,
        partnerLastName: partnerLastName || null,
        partnerEmail: partnerEmail || null,
        reservedSeats,
        rsvpdCount,
        songRequest: songRequest || null
      }
    })

    return NextResponse.json({
      success: true,
      guest
    })
  } catch (error) {
    console.error('Error creating guest:', error)
    return NextResponse.json(
      { error: 'Failed to create guest' },
      { status: 500 }
    )
  }
}