import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendEmail, generateSaveTheDateEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Generate a test save-the-date email
    const emailTemplate = generateSaveTheDateEmail(
      session.user.email.split('@')[0], // Use part of admin email as name
      'TEST2026'
    )

    // Add test indicator to subject
    emailTemplate.subject = `[TEST] ${emailTemplate.subject}`

    const result = await sendEmail({
      ...emailTemplate,
      to: session.user.email
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test save-the-date sent successfully',
        messageId: result.messageId
      })
    } else {
      return NextResponse.json({
        error: `Failed to send test save-the-date: ${result.error}`
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error sending test save-the-date:', error)
    return NextResponse.json(
      { error: 'Failed to send test save-the-date' },
      { status: 500 }
    )
  }
}