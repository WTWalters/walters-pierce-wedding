import { formatAddedDate } from './review'

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
    // 'matched'   — RSVP matched a guest already on the list (imported).
    // 'added'     — a guest you approved from To Review (see addedAt).
    // 'unmatched' — not on the list yet; sitting in To Review.
    status: 'matched' | 'added' | 'unmatched'
    addedAt?: Date | string | null
    matchedBy?: 'email' | 'name'
    emailOnFile?: string
  }
): Rendered {
  const name = `${data.firstName} ${data.lastName}`
  const verdict = data.attending ? 'YES' : 'declined'
  const matchTag =
    data.status === 'matched'
      ? data.matchedBy === 'name'
        ? 'matched by NAME'
        : 'matched'
      : data.status === 'added'
        ? 'added'
        : 'UNMATCHED'
  const subject = `RSVP ${verdict} (${matchTag}): ${name}${data.attending && data.partySize ? ` — party of ${data.partySize}` : ''}`
  const guestStatus =
    data.status === 'matched'
      ? 'Matched — on your guest list'
      : data.status === 'added'
        ? `Added by you on ${data.addedAt ? formatAddedDate(data.addedAt) : 'an earlier date'}`
        : 'No — not on the original list, review before sending details'
  const rows: Array<[string, string]> = [
    ['Name', name],
    ['Email', data.email],
    ['Attending', data.attending ? `Yes — party of ${data.partySize ?? 1}` : 'No'],
    ['Dietary restrictions', data.dietaryRestrictions || '—'],
    ['Song request', data.songRequest || '—'],
    ['Guest status', guestStatus],
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

// Builds a calendar attachment from the admin-entered wedding details.
// Returns null when date/time don't parse (e.g. still "TBA") — the email
// simply goes out without an attachment; the text details are authoritative.
export function generateWeddingIcs(d: WeddingDetails): string | null {
  const start = new Date(`${d.date} ${d.time}`)
  if (isNaN(start.getTime())) return null
  const end = new Date(start.getTime() + 6 * 60 * 60 * 1000)
  const stamp = (dt: Date) =>
    `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}T${String(dt.getHours()).padStart(2, '0')}${String(dt.getMinutes()).padStart(2, '0')}00`
  // RFC 5545 TEXT escaping for commas/semicolons/backslashes
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
  const location = esc([d.venueName, d.venueAddress].filter(Boolean).join(', '))
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Emme & Connor//Wedding//EN',
    'BEGIN:VEVENT',
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    "SUMMARY:Emme & Connor's Wedding",
    'DESCRIPTION:Join us as we celebrate our special day!',
    `LOCATION:${location}`,
    'UID:wedding-emme-connor-2026',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

// Break a one-line address into stacked lines ("street" / "city, state zip") so the
// venue reads like a mailing address. Honors explicit newlines if the address was
// entered multi-line; otherwise splits at the first comma (street vs. the rest).
function venueAddressLines(raw: string): string[] {
  const t = (raw || '').trim()
  if (!t) return []
  const parts = t.includes('\n')
    ? t.split('\n')
    : (() => {
        const i = t.indexOf(',')
        return i === -1 ? [t] : [t.slice(0, i), t.slice(i + 1)]
      })()
  return parts.map((s) => s.trim()).filter(Boolean)
}

export function generateRsvpYesEmail(
  firstName: string,
  details: WeddingDetails,
  guestCount?: number | null
): Rendered {
  const name = escapeHtml(firstName || 'there')
  const venueName = escapeHtml(details.venueName || 'our venue')
  const addrLines = venueAddressLines(details.venueAddress || '')
  const venueLinesHtml = addrLines.map((l) => escapeHtml(l)).join('<br>')
  const venueLinesText = addrLines.join('\n')
  // Confirm the party size back to the guest so they can catch a wrong count.
  const count = guestCount != null && guestCount > 0 ? guestCount : null
  const countSentence = count ? `We have you down for ${count} ${count === 1 ? 'guest' : 'guests'}.` : ''
  const body = `
    <p>Hi ${name}! Thank you so much for your RSVP! We are so happy to hear that you'll be there
    to share our special day with us. Get ready for an amazing night!</p>
    ${count ? `<p>We have you down for <strong>${count}</strong> ${count === 1 ? 'guest' : 'guests'}.</p>` : ''}
    <p style="margin-bottom:4px;">Our venue is</p>
    <p style="margin-top:0;"><strong>${venueName}</strong>${venueLinesHtml ? `<br>${venueLinesHtml}` : ''}</p>`
  const text = `Hi ${firstName || 'there'}! Thank you so much for your RSVP! We are so happy to hear that `
    + `you'll be there to share our special day with us. Get ready for an amazing night!\n\n`
    + (countSentence ? `${countSentence}\n\n` : '')
    + `Our venue is\n${details.venueName || 'our venue'}${venueLinesText ? `\n${venueLinesText}` : ''}\n`
  return { subject: 'Thank you for your RSVP — Emme & Connor', html: wrap('We can’t wait to celebrate!', body), text }
}

export function generateRsvpNoEmail(firstName: string): Rendered {
  const name = escapeHtml(firstName || 'there')
  const body = `<p>Hi ${name}, thank you for updating your RSVP! We are so sorry to miss you on our
    special day, but we truly appreciate you letting us know.</p>`
  const text = `Hi ${firstName || 'there'}, thank you for updating your RSVP! We are so sorry to miss you on our special day, `
    + `but we truly appreciate you letting us know.`
  return { subject: 'Thank you for your RSVP — Emme & Connor', html: wrap('We’ll miss you', body), text }
}

export function generateRsvpOverCountEmail(
  firstName: string,
  rsvpdCount: number | null,
  reservedSeats: number | null
): Rendered {
  const name = escapeHtml(firstName || 'there')
  const submitted = rsvpdCount ?? 0
  const seatsPhrase = reservedSeats != null
    ? `the ${reservedSeats} spots listed on your invitation`
    : `the number of spots listed on your invitation`
  const body = `
    <p>Hi ${name}! We are so looking forward to having you at our wedding. We noticed your
    RSVP included ${submitted} guests, but due to our intimate guest count and venue space,
    we are only able to host ${seatsPhrase}. Let us know if you can still celebrate with us
    within that count—we'd love to have you!</p>`
  const text = `Hi ${firstName || 'there'}! We are so looking forward to having you at our wedding. `
    + `We noticed your RSVP included ${submitted} guests, but due to our intimate guest count `
    + `and venue space, we are only able to host ${reservedSeats != null ? `the ${reservedSeats} spots` : 'the spots'} `
    + `listed on your invitation. Let us know if you can still celebrate with us within that count—we'd love to have you!`
  return { subject: 'A quick note about your RSVP — Emme & Connor', html: wrap('A quick note about your RSVP', body), text }
}

export function generateRegistryThankYouEmail(data: {
  name: string
  tierTitle: string
  amount: number
}): Rendered {
  const name = escapeHtml(data.name)
  const tier = escapeHtml(data.tierTitle)
  const amount = `$${data.amount.toLocaleString('en-US')}`
  const subject = `Thank you for your honeymoon gift, ${data.name}!`
  const body = `
    <p>Dear ${name},</p>
    <p>Thank you so much for your generous gift of <strong>${amount}</strong> toward
    <strong>${tier}</strong>. It means the world to us as we get ready for our honeymoon in Ireland.</p>
    <p>We can't wait to celebrate with you — and we'll be sure to share a photo of us enjoying it!</p>
    <p style="margin-top: 24px;">With love and gratitude,<br><strong>Emme &amp; Connor</strong></p>`
  const html = wrap('A heartfelt thank you', body)
  const text = `Dear ${data.name},\n\nThank you so much for your generous gift of ${amount} toward ${data.tierTitle}. `
    + `It means the world to us as we get ready for our honeymoon in Ireland. We can't wait to celebrate with you.\n\n`
    + `With love and gratitude,\nEmme & Connor\nwalters-pierce-wedding.com`
  return { subject, html, text }
}
