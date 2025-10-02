import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const testEmail = {
      to: session.user.email,
      subject: 'Test Email - Walters-Pierce Wedding System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #00330a, #004d0f); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Test Email</h1>
            <p style="margin: 10px 0 0 0;">Walters-Pierce Wedding System</p>
          </div>
          
          <div style="background: white; padding: 30px; border: 1px solid #e5e5e5;">
            <h2 style="color: #00330a;">Email System Working! ✅</h2>
            <p>This is a test email to verify that your email integration is working correctly.</p>
            
            <div style="background: #f0f8f0; padding: 15px; border-left: 4px solid #00330a; margin: 20px 0;">
              <strong>Test Details:</strong><br>
              Sent to: ${session.user.email}<br>
              Sent at: ${new Date().toLocaleString()}<br>
              System: ${process.env.MAILERLITE_API_KEY ? 'MailerLite (Production)' : 'Development Mode'}
            </div>
            
            <p>If you're seeing this email, your wedding website email system is configured correctly!</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>Wedding Website System</strong>
            </p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; border-radius: 0 0 8px 8px;">
            This is an automated test email from the Walters-Pierce Wedding website.
          </div>
        </div>
      `,
      text: `
        Test Email - Walters-Pierce Wedding System
        
        Email System Working! ✅
        
        This is a test email to verify that your email integration is working correctly.
        
        Test Details:
        Sent to: ${session.user.email}
        Sent at: ${new Date().toLocaleString()}
        System: ${process.env.MAILERLITE_API_KEY ? 'MailerLite (Production)' : 'Development Mode'}
        
        If you're seeing this email, your wedding website email system is configured correctly!
        
        Best regards,
        Wedding Website System
      `
    }

    const result = await sendEmail(testEmail)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully',
        messageId: result.messageId
      })
    } else {
      return NextResponse.json({
        error: `Failed to send test email: ${result.error}`
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error sending test email:', error)
    return NextResponse.json(
      { error: 'Failed to send test email' },
      { status: 500 }
    )
  }
}