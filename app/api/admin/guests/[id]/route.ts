import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()

    // Validate required fields
    if (!body.firstName || !body.lastName || !body.email) {
      return NextResponse.json(
        { error: 'First name, last name, and email are required' },
        { status: 400 }
      )
    }

    // Check if email is already taken by another guest
    const existingGuest = await prisma.guest.findFirst({
      where: {
        email: body.email,
        id: { not: id }
      }
    })

    if (existingGuest) {
      return NextResponse.json(
        { error: 'Email is already taken by another guest' },
        { status: 400 }
      )
    }

    // Update guest
    const updatedGuest = await prisma.guest.update({
      where: { id },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone || null,
        addressLine1: body.addressLine1 || null,
        addressLine2: body.addressLine2 || null,
        city: body.city || null,
        state: body.state || null,
        zipCode: body.zipCode || null,
        country: body.country || null,
        tableNumber: body.tableNumber ? parseInt(body.tableNumber) : null,
        dietaryRestrictions: body.dietaryRestrictions || null,
        specialRequests: body.specialRequests || null,
        notes: body.notes || null,
        attending: body.attending !== undefined ? body.attending : null
      },
      include: {
        plusOnes: true
      }
    })

    return NextResponse.json({ 
      success: true, 
      guest: updatedGuest 
    })

  } catch (error) {
    console.error('Error updating guest:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Guest not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update guest' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Delete guest (this will also delete associated plus-ones due to cascade)
    await prisma.guest.delete({
      where: { id }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Guest deleted successfully' 
    })

  } catch (error) {
    console.error('Error deleting guest:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Guest not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete guest' },
      { status: 500 }
    )
  }
}