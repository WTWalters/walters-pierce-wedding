import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail, generateSaveTheDateEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all guests who haven't received save-the-dates yet
    const guests = await prisma.guest.findMany({
      where: {
        invitationCode: { not: null },
        invitationSentAt: null // Haven't received save-the-date yet
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        invitationCode: true
      }
    })

    if (guests.length === 0) {
      return NextResponse.json({ 
        error: 'No guests found who need save-the-dates' 
      }, { status: 400 })
    }

    let successCount = 0
    let failureCount = 0

    // Send save-the-date emails
    for (const guest of guests) {
      try {
        const emailTemplate = generateSaveTheDateEmail(
          `${guest.firstName} ${guest.lastName}`,
          guest.invitationCode!
        )

        const result = await sendEmail({
          ...emailTemplate,
          to: guest.email
        })

        // Update guest record and log email
        await prisma.$transaction(async (tx) => {
          // Mark invitation as sent
          await tx.guest.update({
            where: { id: guest.id },
            data: { invitationSentAt: new Date() }
          })

          // Log the email
          await tx.emailLog.create({
            data: {
              guestId: guest.id,
              emailType: 'save_the_date',
              recipientEmail: guest.email,
              subject: emailTemplate.subject,
              status: result.success ? 'sent' : 'failed',
              sendgridMessageId: result.messageId
            }
          })
        })

        if (result.success) {
          successCount++
        } else {
          failureCount++
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`Failed to send save-the-date to ${guest.email}:`, error)
        failureCount++
      }
    }

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failureCount,
      total: guests.length
    })

  } catch (error) {
    console.error('Error sending save-the-dates:', error)
    return NextResponse.json(
      { error: 'Failed to send save-the-dates' },
      { status: 500 }
    )
  }
}