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
    const { 
      firstName, 
      lastName, 
      email, 
      phone, 
      addressLine1, 
      addressLine2, 
      city, 
      state, 
      zipCode, 
      notes 
    } = data

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: 'First name, last name, and email are required' },
        { status: 400 }
      )
    }

    // Check if guest with this email already exists
    const existingGuest = await prisma.guest.findUnique({
      where: { email }
    })

    if (existingGuest) {
      return NextResponse.json(
        { error: 'A guest with this email already exists' },
        { status: 400 }
      )
    }

    // Create new guest
    const guest = await prisma.guest.create({
      data: {
        firstName,
        lastName,
        email,
        phone: phone || null,
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        notes: notes || null
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