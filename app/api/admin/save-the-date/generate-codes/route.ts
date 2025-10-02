import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function generateInvitationCode(firstName: string, lastName: string): string {
  // Create a code using first letters of names + year
  const firstInitial = firstName.charAt(0).toUpperCase()
  const lastInitial = lastName.charAt(0).toUpperCase()
  const year = '2026'
  
  // Add some randomness to avoid conflicts
  const random = Math.floor(Math.random() * 99).toString().padStart(2, '0')
  
  return `${firstInitial}${lastInitial}${year}-${random}`
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find guests without invitation codes
    const guestsWithoutCodes = await prisma.guest.findMany({
      where: {
        invitationCode: null,
        email: { not: '' } // Only guests with email addresses
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      }
    })

    if (guestsWithoutCodes.length === 0) {
      return NextResponse.json({ 
        message: 'All guests already have invitation codes',
        generated: 0 
      })
    }

    let generated = 0

    // Generate codes for each guest
    for (const guest of guestsWithoutCodes) {
      let attempts = 0
      let code = ''
      let isUnique = false

      // Try to generate a unique code (max 10 attempts)
      while (!isUnique && attempts < 10) {
        code = generateInvitationCode(guest.firstName, guest.lastName)
        
        // Check if code already exists
        const existingGuest = await prisma.guest.findUnique({
          where: { invitationCode: code }
        })
        
        if (!existingGuest) {
          isUnique = true
        }
        attempts++
      }

      if (isUnique) {
        // Update guest with the new invitation code
        await prisma.guest.update({
          where: { id: guest.id },
          data: { invitationCode: code }
        })
        
        generated++
        console.log(`Generated code ${code} for ${guest.firstName} ${guest.lastName}`)
      } else {
        console.error(`Failed to generate unique code for ${guest.firstName} ${guest.lastName}`)
      }
    }

    return NextResponse.json({
      success: true,
      generated,
      total: guestsWithoutCodes.length
    })

  } catch (error) {
    console.error('Error generating invitation codes:', error)
    return NextResponse.json(
      { error: 'Failed to generate invitation codes' },
      { status: 500 }
    )
  }
}