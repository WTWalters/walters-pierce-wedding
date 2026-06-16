import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { rateLimit, clientIp } from '@/lib/rate-limit'

const MAX_PLUS_ONES = 10

// Only persist a sane child age (0–17); otherwise store null.
function clampChildAge(isChild: unknown, age: unknown): number | null {
  if (!isChild) return null
  const n = parseInt(String(age), 10)
  return Number.isInteger(n) && n >= 0 && n <= 17 ? n : null
}

export async function POST(request: NextRequest) {
  try {
    const { allowed } = rateLimit(`rsvp-submit:${clientIp(request)}`, 20, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute and try again.' },
        { status: 429 }
      )
    }

    const { guestId, attending, dietaryRestrictions, specialRequests, plusOnes } = await request.json()

    if (!guestId || attending === null || attending === undefined) {
      return NextResponse.json(
        { error: 'Guest ID and attendance status are required' },
        { status: 400 }
      )
    }

    if (typeof attending !== 'boolean') {
      return NextResponse.json(
        { error: 'Attendance status must be true or false' },
        { status: 400 }
      )
    }

    // Bound the plus-ones payload to prevent data-bloat / abuse.
    if (plusOnes !== undefined && !Array.isArray(plusOnes)) {
      return NextResponse.json({ error: 'Invalid plus-ones' }, { status: 400 })
    }
    if (Array.isArray(plusOnes) && plusOnes.length > MAX_PLUS_ONES) {
      return NextResponse.json(
        { error: `A maximum of ${MAX_PLUS_ONES} additional guests is allowed` },
        { status: 400 }
      )
    }

    // Start a transaction to update guest and handle plus ones
    const result = await prisma.$transaction(async (tx) => {
      // Update the main guest
      const updatedGuest = await tx.guest.update({
        where: { id: guestId },
        data: {
          attending,
          dietaryRestrictions: dietaryRestrictions || null,
          specialRequests: specialRequests || null,
          rsvpReceivedAt: new Date()
        }
      })

      // Delete existing plus ones for this guest
      await tx.plusOne.deleteMany({
        where: { guestId }
      })

      // Add new plus ones if attending
      if (attending && plusOnes && plusOnes.length > 0) {
        const validPlusOnes = plusOnes.filter((po: any) => 
          po.firstName && po.firstName.trim() && po.lastName && po.lastName.trim()
        )

        if (validPlusOnes.length > 0) {
          await tx.plusOne.createMany({
            data: validPlusOnes.map((plusOne: any) => ({
              guestId,
              firstName: plusOne.firstName.trim(),
              lastName: plusOne.lastName.trim(),
              dietaryRestrictions: plusOne.dietaryRestrictions || null,
              isChild: plusOne.isChild || false,
              age: clampChildAge(plusOne.isChild, plusOne.age)
            }))
          })
        }
      }

      return updatedGuest
    })

    // Send RSVP confirmation email
    try {
      const { sendEmail, generateRSVPConfirmationEmail } = await import('@/lib/email')
      
      const emailTemplate = generateRSVPConfirmationEmail({
        guestName: `${result.firstName} ${result.lastName}`,
        attending,
        plusOnes: attending && plusOnes ? plusOnes.filter((po: any) => po.firstName && po.lastName) : undefined,
        dietaryRestrictions: dietaryRestrictions || undefined,
        specialRequests: specialRequests || undefined
      })

      const emailResult = await sendEmail({
        ...emailTemplate,
        to: result.email
      })

      // Log the RSVP submission and email status
      await prisma.emailLog.create({
        data: {
          guestId,
          emailType: 'rsvp_confirmation',
          recipientEmail: result.email,
          subject: emailTemplate.subject,
          status: emailResult.success ? 'sent' : 'failed'
        }
      })
    } catch (emailError) {
      console.error('Failed to send RSVP confirmation email:', emailError)
      // Don't fail the RSVP submission if email fails
    }

    // Set session cookie if guest is attending
    const response = NextResponse.json({ 
      success: true, 
      message: 'RSVP submitted successfully',
      guest: result,
      canAccessDetails: attending === true
    })

    if (attending === true) {
      // Set a secure session cookie for accessing wedding details
      const sessionData = {
        guestId: result.id,
        timestamp: new Date().toISOString()
      }

      const cookieStore = cookies()
      cookieStore.set('rsvp-session', JSON.stringify(sessionData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      })
    }

    return response
  } catch (error) {
    console.error('Error submitting RSVP:', error)
    return NextResponse.json(
      { error: 'Failed to submit RSVP' },
      { status: 500 }
    )
  }
}