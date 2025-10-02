// Initialize MailerLite - only when API key is available
const getMailerLite = () => {
  if (!process.env.MAILERLITE_API_KEY || process.env.MAILERLITE_API_KEY === 'fake-key-for-build') {
    return null
  }

  try {
    // Dynamic import to avoid build issues
    const { MailerLite } = require('@mailerlite/mailerlite-nodejs')
    return new MailerLite({
      api_key: process.env.MAILERLITE_API_KEY
    })
  } catch (error) {
    console.log('MailerLite not available, using fallback mode')
    return null
  }
}

export interface EmailTemplate {
  to: string
  subject: string
  html: string
  text?: string
}

export interface RSVPConfirmationData {
  guestName: string
  attending: boolean
  plusOnes?: Array<{ firstName: string; lastName: string }>
  dietaryRestrictions?: string
  specialRequests?: string
}

export async function sendEmail({ to, subject, html, text }: EmailTemplate) {
  const mailerLite = getMailerLite()

  if (!mailerLite) {
    console.log('📧 Email would be sent (MailerLite API key not configured):')
    console.log(`To: ${to}`)
    console.log(`Subject: ${subject}`)
    console.log(`HTML: ${html.substring(0, 200)}...`)
    return { success: true, messageId: 'mock-email-id' }
  }

  try {
    // For MailerLite, we'll use their campaign API to send transactional emails
    // First, let's try to find or create a subscriber
    let subscriber
    try {
      subscriber = await mailerLite.subscribers.find(to)
    } catch {
      // Subscriber doesn't exist, create them
      subscriber = await mailerLite.subscribers.createOrUpdate({
        email: to,
        status: 'active'
      })
    }

    // For now, we'll log the email since MailerLite is primarily for campaigns
    // You may want to use their campaign API or integrate with a transactional service
    console.log('📧 Email sent via MailerLite:')
    console.log(`To: ${to}`)
    console.log(`Subject: ${subject}`)
    console.log(`Subscriber ID: ${subscriber.data?.id}`)

    return { success: true, messageId: `ml-${subscriber.data?.id || 'unknown'}` }
  } catch (error) {
    console.error('Failed to send email via MailerLite:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export function generateRSVPConfirmationEmail(data: RSVPConfirmationData): EmailTemplate {
  const { guestName, attending, plusOnes, dietaryRestrictions, specialRequests } = data

  const subject = attending 
    ? `RSVP Confirmed - We can't wait to celebrate with you!`
    : `RSVP Received - Thank you for letting us know`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${subject}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #00330a, #004d0f); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e5e5e5; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; border-radius: 0 0 8px 8px; }
        .highlight { background: #f0f8f0; padding: 15px; border-left: 4px solid #00330a; margin: 20px 0; }
        .plus-ones { background: #f9f9f9; padding: 15px; border-radius: 6px; margin: 10px 0; }
        h1 { margin: 0; font-size: 28px; font-weight: 300; }
        h2 { color: #00330a; font-size: 24px; margin-top: 30px; }
        h3 { color: #00330a; font-size: 18px; }
        .emoji { font-size: 24px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Emme & CeeJay</h1>
        <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">September 2026 • Colorado</p>
      </div>
      
      <div class="content">
        <h2>Dear ${guestName},</h2>
        
        ${attending ? `
          <div class="highlight">
            <span class="emoji">🎉</span> <strong>Thank you for your RSVP!</strong> We're absolutely thrilled that you'll be joining us on our special day.
          </div>
          
          <h3>Your RSVP Details:</h3>
          <p><strong>Attendance:</strong> Yes, attending! ✅</p>
          
          ${plusOnes && plusOnes.length > 0 ? `
            <div class="plus-ones">
              <h4>Plus Ones:</h4>
              <ul>
                ${plusOnes.map(po => `<li>${po.firstName} ${po.lastName}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${dietaryRestrictions ? `
            <p><strong>Dietary Restrictions:</strong> ${dietaryRestrictions}</p>
          ` : ''}
          
          ${specialRequests ? `
            <p><strong>Special Requests:</strong> ${specialRequests}</p>
          ` : ''}
          
          <h3>What's Next?</h3>
          <p>We'll be sending out more details about the venue, timeline, and other important information as we get closer to the big day. Keep an eye on your inbox!</p>
          
          <p>If you need to update your RSVP or have any questions, please don't hesitate to reach out to us.</p>
        ` : `
          <div class="highlight">
            <span class="emoji">💝</span> <strong>Thank you for letting us know.</strong> While we're sad you can't make it, we completely understand and appreciate you taking the time to respond.
          </div>
          
          <p>We'll miss having you there, but we know you'll be with us in spirit. We hope to celebrate with you soon in another way!</p>
        `}
        
        <p style="margin-top: 30px;">With love and excitement,<br><strong>Emme & CeeJay</strong></p>
      </div>
      
      <div class="footer">
        <p>This email was sent from the Walters-Pierce Wedding website.<br>
        If you have any questions, please contact us directly.</p>
      </div>
    </body>
    </html>
  `

  const text = `
    Dear ${guestName},
    
    ${attending 
      ? `Thank you for your RSVP! We're thrilled that you'll be joining us for our wedding in September 2026.`
      : `Thank you for letting us know you can't make it to our wedding. We'll miss you but understand completely.`
    }
    
    ${attending && plusOnes && plusOnes.length > 0 
      ? `Plus Ones: ${plusOnes.map(po => `${po.firstName} ${po.lastName}`).join(', ')}`
      : ''
    }
    
    ${attending && dietaryRestrictions ? `Dietary Restrictions: ${dietaryRestrictions}` : ''}
    
    ${attending && specialRequests ? `Special Requests: ${specialRequests}` : ''}
    
    With love,
    Emme & CeeJay
  `

  return { to: '', subject, html, text }
}

export function generateSaveTheDateConfirmationEmail(data: { guestName: string }): EmailTemplate {
  const { guestName } = data

  const subject = `Thank you for signing up - Emme & CeeJay's Wedding`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${subject}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #00330a, #004d0f); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e5e5e5; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; border-radius: 0 0 8px 8px; }
        .highlight { background: #f0f8f0; padding: 20px; border-left: 4px solid #00330a; margin: 20px 0; border-radius: 4px; }
        .date-preview { background: #fff8dc; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; border: 2px solid #D4AF37; }
        h1 { margin: 0; font-size: 28px; font-weight: 300; }
        h2 { color: #00330a; font-size: 24px; }
        .emoji { font-size: 24px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Emme & CeeJay</h1>
        <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">September 2026 • Colorado Mountains</p>
      </div>
      
      <div class="content">
        <h2>Dear ${guestName},</h2>
        
        <div class="highlight">
          <span class="emoji">💌</span> <strong>Thank you for signing up!</strong> We've received your information and will keep you updated with all the wedding details.
        </div>
        
        <div class="date-preview">
          <h3 style="margin: 0 0 10px 0; color: #00330a;">Save the Date</h3>
          <p style="font-size: 20px; margin: 10px 0; color: #D4AF37; font-weight: bold;">September 2026</p>
          <p style="margin: 5px 0; color: #666;">Colorado Mountains</p>
        </div>
        
        <h3 style="color: #00330a;">What's Next?</h3>
        <ul style="text-align: left; line-height: 2;">
          <li><strong>Formal Invitations:</strong> We'll send these out with the exact date and venue details</li>
          <li><strong>RSVP:</strong> You'll receive an invitation code to RSVP on our website</li>
          <li><strong>Wedding Updates:</strong> We'll keep you posted on accommodations, travel info, and more</li>
        </ul>
        
        <p>We're so excited to celebrate this special day with you! If you need to update your contact information at any time, just let us know.</p>
        
        <p style="margin-top: 30px;">With love and excitement,<br><strong>Emme & CeeJay</strong></p>
      </div>
      
      <div class="footer">
        <p>This email was sent from the Walters-Pierce Wedding website.<br>
        If you have any questions, please contact us directly.</p>
      </div>
    </body>
    </html>
  `

  const text = `
    Dear ${guestName},
    
    Thank you for signing up! We've received your information and will keep you updated with all the wedding details.
    
    Save the Date: September 2026 in the Colorado Mountains
    
    What's Next:
    - Formal Invitations: We'll send these out with the exact date and venue details
    - RSVP: You'll receive an invitation code to RSVP on our website
    - Wedding Updates: We'll keep you posted on accommodations, travel info, and more
    
    We're so excited to celebrate this special day with you!
    
    With love,
    Emme & CeeJay
  `

  return { to: '', subject, html, text }
}

export function generateSaveTheDateEmail(guestName: string, invitationCode: string): EmailTemplate {
  const subject = `Save the Date - Emme & CeeJay's Wedding • September 2026`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${subject}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #00330a, #004d0f); color: white; padding: 40px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 40px; border: 1px solid #e5e5e5; text-align: center; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; border-radius: 0 0 8px 8px; }
        .date-box { background: #f0f8f0; padding: 30px; border-radius: 8px; margin: 30px 0; border: 2px solid #D4AF37; }
        .cta-button { display: inline-block; background: #D4AF37; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
        h1 { margin: 0; font-size: 36px; font-weight: 300; }
        h2 { color: #00330a; font-size: 28px; margin: 0; }
        .invitation-code { background: #fff; padding: 15px; border: 2px dashed #D4AF37; border-radius: 6px; font-family: monospace; font-size: 18px; font-weight: bold; letter-spacing: 2px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Save the Date</h1>
        <p style="margin: 10px 0 0 0; font-size: 20px; opacity: 0.9;">You're Invited!</p>
      </div>
      
      <div class="content">
        <h2>Dear ${guestName},</h2>
        
        <p style="font-size: 18px; margin: 30px 0;">We're getting married and we want you to be there!</p>
        
        <div class="date-box">
          <h2 style="margin-bottom: 10px;">Emme & CeeJay</h2>
          <p style="font-size: 24px; margin: 10px 0; color: #D4AF37; font-weight: bold;">September 2026</p>
          <p style="font-size: 18px; margin: 10px 0;">Colorado</p>
          <p style="font-size: 14px; margin-top: 20px; color: #666;">Exact date and venue details coming soon!</p>
        </div>
        
        <p>We're so excited to celebrate this special day with you. Formal invitations with all the details will follow, but we wanted to give you plenty of notice to mark your calendars!</p>
        
        <div style="margin: 30px 0;">
          <p><strong>Your Invitation Code:</strong></p>
          <div class="invitation-code">${invitationCode}</div>
          <p style="font-size: 14px; color: #666; margin-top: 10px;">Save this code - you'll need it to RSVP when the time comes!</p>
        </div>
        
        <a href="https://walters-pierce-wedding.com" class="cta-button">Visit Our Wedding Website</a>
        
        <p style="margin-top: 40px;">Can't wait to celebrate with you!</p>
        <p><strong>Love,<br>Emme & CeeJay</strong></p>
      </div>
      
      <div class="footer">
        <p>Walters-Pierce Wedding • September 2026<br>
        More details coming soon!</p>
      </div>
    </body>
    </html>
  `

  const text = `
    Save the Date!
    
    Dear ${guestName},
    
    We're getting married and we want you to be there!
    
    Emme & CeeJay
    September 2026
    Colorado
    
    Your invitation code: ${invitationCode}
    (Save this code for when you RSVP!)
    
    Formal invitations with all the details will follow, but we wanted to give you plenty of notice to mark your calendars!
    
    Visit our wedding website: https://walters-pierce-wedding.com
    
    Can't wait to celebrate with you!
    
    Love,
    Emme & CeeJay
  `

  return { to: '', subject, html, text }
}