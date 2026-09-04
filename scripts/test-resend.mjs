// One-off smoke test: proves Resend + domain verification works end-to-end.
// Usage: node scripts/test-resend.mjs <recipient>
// The recipient is required on purpose: this really sends, and the default used to
// be Nicolle's personal address, so a bare run mailed the coordinator by accident.
import { config } from 'dotenv'
import { Resend } from 'resend'

config({ path: '.env.local' })

const apiKey = process.env.RESEND_API_KEY
const from = process.env.FROM_EMAIL
const to = process.argv[2]

if (!to) {
  console.error('Usage: node scripts/test-resend.mjs <recipient>')
  process.exit(1)
}
if (!apiKey) {
  console.error('RESEND_API_KEY is not set in .env.local')
  process.exit(1)
}
if (!from) {
  console.error('FROM_EMAIL is not set in .env.local (e.g. "Emme & Connor\'s Wedding <rsvp@yourdomain>")')
  process.exit(1)
}

const resend = new Resend(apiKey)

const { data, error } = await resend.emails.send({
  from,
  to,
  subject: 'Test: Walters-Pierce wedding RSVP notifications',
  html: `
    <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; border: 1px solid #D4AF37; padding: 24px;">
      <h2 style="color: #00330a; margin-top: 0;">RSVP notification pipe is working 🎉</h2>
      <p>This is a test email from the wedding website's new Resend integration.</p>
      <p>When guests RSVP, notifications will arrive at this address looking roughly like this.</p>
      <p style="color: #888; font-size: 12px;">Sent ${new Date().toISOString()} from scripts/test-resend.mjs</p>
    </div>`,
})

if (error) {
  console.error('❌ Send failed:', error)
  process.exit(1)
}
console.log('✅ Sent! Resend message id:', data.id)
console.log(`Check the inbox (and spam folder) of ${to}`)
