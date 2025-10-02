import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Email validation regex
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

// US phone number validation (accepts various formats)
const phoneRegex = /^(\+1)?[-.\s]?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/

// Function to normalize phone number to standard format
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')
  
  // Add country code if not present
  if (digits.length === 10) {
    return `+1${digits}`
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }
  
  return `+${digits}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      firstName,
      lastName,
      email,
      phone,
      address,
      city,
      state,
      zipCode,
      dietaryRestrictions
    } = body

    // Validation
    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: 'First name, last name, and email are required' },
        { status: 400 }
      )
    }

    // Validate email format
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    // Validate phone number if provided
    let normalizedPhone: string | null = null
    if (phone && phone.trim()) {
      if (!phoneRegex.test(phone)) {
        return NextResponse.json(
          { error: 'Please enter a valid US phone number (e.g., 555-555-5555)' },
          { status: 400 }
        )
      }
      normalizedPhone = normalizePhoneNumber(phone)
    }

    // Check if guest already exists by email
    const existingGuest = await prisma.guest.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (existingGuest) {
      // Update existing guest with new information
      const updatedGuest = await prisma.guest.update({
        where: { email: email.toLowerCase() },
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: normalizedPhone,
          addressLine1: address?.trim() || null,
          city: city?.trim() || null,
          state: state?.trim() || null,
          zipCode: zipCode?.trim() || null,
          dietaryRestrictions: dietaryRestrictions?.trim() || null,
          updatedAt: new Date()
        }
      })

      // Log the update
      await prisma.auditLog.create({
        data: {
          action: 'save_the_date_update',
          entityType: 'guest',
          entityId: updatedGuest.id,
          newValues: {
            firstName: updatedGuest.firstName,
            lastName: updatedGuest.lastName,
            phone: updatedGuest.phone,
            addressLine1: updatedGuest.addressLine1,
            city: updatedGuest.city,
            state: updatedGuest.state,
            zipCode: updatedGuest.zipCode,
            dietaryRestrictions: updatedGuest.dietaryRestrictions
          }
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Your information has been updated successfully!',
        guest: {
          id: updatedGuest.id,
          firstName: updatedGuest.firstName,
          lastName: updatedGuest.lastName,
          email: updatedGuest.email
        }
      })
    } else {
      // Create new guest
      const newGuest = await prisma.guest.create({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.toLowerCase().trim(),
          phone: normalizedPhone,
          addressLine1: address?.trim() || null,
          city: city?.trim() || null,
          state: state?.trim() || null,
          zipCode: zipCode?.trim() || null,
          dietaryRestrictions: dietaryRestrictions?.trim() || null
        }
      })

      // Log the creation
      await prisma.auditLog.create({
        data: {
          action: 'save_the_date_signup',
          entityType: 'guest',
          entityId: newGuest.id,
          newValues: {
            firstName: newGuest.firstName,
            lastName: newGuest.lastName,
            email: newGuest.email,
            phone: newGuest.phone
          }
        }
      })

      // Try to send confirmation email
      try {
        const { sendEmail, generateSaveTheDateConfirmationEmail } = await import('@/lib/email')
        
        const emailTemplate = generateSaveTheDateConfirmationEmail({
          guestName: `${newGuest.firstName} ${newGuest.lastName}`
        })

        const emailResult = await sendEmail({
          ...emailTemplate,
          to: newGuest.email
        })

        // Log the email
        await prisma.emailLog.create({
          data: {
            guestId: newGuest.id,
            emailType: 'save_the_date_confirmation',
            recipientEmail: newGuest.email,
            subject: emailTemplate.subject,
            status: emailResult.success ? 'sent' : 'failed'
          }
        })
      } catch (emailError) {
        console.error('Failed to send save-the-date confirmation email:', emailError)
        // Don't fail the submission if email fails
      }

      return NextResponse.json({
        success: true,
        message: 'Thank you for signing up! We\'ll keep you updated with wedding details.',
        guest: {
          id: newGuest.id,
          firstName: newGuest.firstName,
          lastName: newGuest.lastName,
          email: newGuest.email
        }
      })
    }
  } catch (error) {
    console.error('Error processing save-the-date submission:', error)
    
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'This email is already registered' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to save your information. Please try again.' },
      { status: 500 }
    )
  }
}

// GET endpoint to check if an email is already registered
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      )
    }

    const guest = await prisma.guest.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      }
    })

    return NextResponse.json({
      exists: !!guest,
      guest: guest || null
    })
  } catch (error) {
    console.error('Error checking email:', error)
    return NextResponse.json(
      { error: 'Failed to check email' },
      { status: 500 }
    )
  }
}
