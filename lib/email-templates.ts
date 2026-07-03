interface Rendered { subject: string; html: string; text: string }

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const wrap = (title: string, bodyHtml: string) => `
<div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; margin: 0 auto; background: #FFFDF7;">
  <div style="background: #00330a; padding: 24px; text-align: center;">
    <h1 style="color: #D4AF37; margin: 0; font-size: 22px; font-weight: normal;">Emme &amp; Connor</h1>
    <p style="color: #FFFDF7; margin: 4px 0 0; font-size: 13px;">September 2026</p>
  </div>
  <div style="padding: 28px 24px; color: #2a2a2a; font-size: 15px; line-height: 1.6;">
    <h2 style="color: #00330a; font-size: 18px; margin-top: 0;">${title}</h2>
    ${bodyHtml}
  </div>
  <div style="border-top: 1px solid #D4AF37; padding: 14px 24px; font-size: 12px; color: #777;">
    walters-pierce-wedding.com
  </div>
</div>`

export interface RsvpSubmissionSummary {
  firstName: string
  lastName: string
  email: string
  attending: boolean
  partySize?: number
  dietaryRestrictions?: string
  songRequest?: string
}

export function generateRsvpNotificationEmail(
  data: RsvpSubmissionSummary & {
    matched: boolean
    matchedBy?: 'email' | 'name'
    emailOnFile?: string
  }
): Rendered {
  const name = `${data.firstName} ${data.lastName}`
  const verdict = data.attending ? 'YES' : 'declined'
  const matchTag = data.matched
    ? data.matchedBy === 'name'
      ? 'matched by NAME'
      : 'matched'
    : 'UNMATCHED'
  const subject = `RSVP ${verdict} (${matchTag}): ${name}${data.attending && data.partySize ? ` — party of ${data.partySize}` : ''}`
  const rows: Array<[string, string]> = [
    ['Name', name],
    ['Email', data.email],
    ['Attending', data.attending ? `Yes — party of ${data.partySize ?? 1}` : 'No'],
    ['Dietary restrictions', data.dietaryRestrictions || '—'],
    ['Song request', data.songRequest || '—'],
    ['On original list', data.matched ? 'Yes' : 'No — not on the original list, review before sending details'],
    ['Received', new Date().toLocaleString('en-US', { timeZone: 'America/Denver' })],
  ]
  if (data.matchedBy === 'name' && data.emailOnFile) {
    rows.splice(2, 0, [
      '⚠ Email check',
      `Matched by name only — submitted email differs from the email on file (${data.emailOnFile}). Gated emails still go to the address on file; verify which is correct before sending details.`,
    ])
  }
  const html = wrap('New RSVP received', `
    <table style="width:100%; border-collapse: collapse;">${rows
      .map(([k, v]) => `<tr><td style="padding:6px 8px; color:#00330a; font-weight:bold; vertical-align:top;">${k}</td><td style="padding:6px 8px;">${escapeHtml(v)}</td></tr>`)
      .join('')}</table>`)
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n')
  return { subject, html, text }
}

export function generateBlockedAttemptEmail(data: RsvpSubmissionSummary): Rendered {
  const name = `${data.firstName} ${data.lastName}`
  const subject = `Blocked RSVP attempt: ${name}`
  const html = wrap('Blocked RSVP attempt', `
    <p>An RSVP was submitted by a name on the private list. Nothing was saved and no reply was sent — the submitter saw the normal thank-you screen.</p>
    <p><strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(data.email)}&gt;<br/>
    Attending: ${data.attending ? 'Yes' : 'No'} · Party: ${data.partySize ?? '—'}</p>`)
  const text = `Blocked RSVP attempt: ${name} <${data.email}>. Attending: ${data.attending ? 'yes' : 'no'}. Nothing saved; no reply sent.`
  return { subject, html, text }
}

export interface WeddingDetails {
  date: string
  time: string
  venueName: string
  venueAddress: string
}

export function generateVenueDetailsEmail(guestFirstName: string, d: WeddingDetails): Rendered {
  const subject = `You're invited — the details for Emme & Connor's wedding`
  const greeting = guestFirstName ? `Dear ${escapeHtml(guestFirstName)},` : 'Hello,'
  const textGreeting = guestFirstName ? `Dear ${guestFirstName},` : 'Hello,'
  const html = wrap('We can’t wait to see you', `
    <p>${greeting}</p>
    <p>Thank you for your RSVP — here is everything you need:</p>
    <table style="width:100%; border-collapse: collapse; margin: 12px 0;">
      <tr><td style="padding:6px 8px; color:#00330a; font-weight:bold;">Date</td><td style="padding:6px 8px;">${d.date}</td></tr>
      <tr><td style="padding:6px 8px; color:#00330a; font-weight:bold;">Time</td><td style="padding:6px 8px;">${d.time}</td></tr>
      <tr><td style="padding:6px 8px; color:#00330a; font-weight:bold;">Venue</td><td style="padding:6px 8px;">${d.venueName}<br/>${d.venueAddress}</td></tr>
    </table>
    <p>If anything changes with your plans, just reply to this email.</p>
    <p style="margin-bottom:0;">With love,<br/>Emme &amp; Connor</p>`)
  const text = `${textGreeting}\n\nThank you for your RSVP — here is everything you need:\n\nDate: ${d.date}\nTime: ${d.time}\nVenue: ${d.venueName}, ${d.venueAddress}\n\nIf anything changes with your plans, just reply to this email.\n\nWith love,\nEmme & Connor`
  return { subject, html, text }
}

export function generateGraciousRegretsEmail(guestFirstName: string): Rendered {
  const subject = `Thank you for your RSVP — Emme & Connor`
  const greeting = guestFirstName ? `Dear ${escapeHtml(guestFirstName)},` : 'Hello,'
  const textGreeting = guestFirstName ? `Dear ${guestFirstName},` : 'Hello,'
  const html = wrap('Thank you', `
    <p>${greeting}</p>
    <p>Thank you so much for responding, and for the kindness of wanting to celebrate with Emme and Connor.</p>
    <p>Because of space, the celebration is limited to a small guest list, and we're so sorry we aren't able to extend the invitation further. It means a great deal that you thought of them.</p>
    <p>The couple would love to share photos and stories after the big day.</p>
    <p style="margin-bottom:0;">With warm thanks,<br/>The Walters &amp; Pierce Families</p>`)
  const text = `${textGreeting}\n\nThank you so much for responding, and for the kindness of wanting to celebrate with Emme and Connor.\n\nBecause of space, the celebration is limited to a small guest list, and we're so sorry we aren't able to extend the invitation further. It means a great deal that you thought of them.\n\nThe couple would love to share photos and stories after the big day.\n\nWith warm thanks,\nThe Walters & Pierce Families`
  return { subject, html, text }
}
