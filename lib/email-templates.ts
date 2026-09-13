import { formatAddedDate } from './review'
import { daysLeftPhrase, formatDeadline } from './rsvp-deadline'

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
    // The address the record held before this RSVP, and whether it was replaced
    // by the submitted one. Not replaced means another guest already holds the
    // submitted address, so the unique index refused it.
    emailOnFile?: string | null
    emailUpdated?: boolean
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
  if (data.matchedBy === 'name' && data.emailUpdated) {
    rows.splice(2, 0, [
      '✎ Email updated',
      `Matched by name. We had ${data.emailOnFile || '(no email)'} on file and replaced it with the address above, which is where their emails will go from now on. Change it in Guest Management if that's wrong.`,
    ])
  } else if (data.matchedBy === 'name' && data.emailUpdated === false && data.emailOnFile) {
    rows.splice(2, 0, [
      '⚠ Email check',
      `Matched by name, but we could not adopt the address above — another guest already has it. ${data.emailOnFile} is still on file and is where their emails will go. Sort out which address belongs to whom before sending details.`,
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
  /** yyyy-mm-dd. Drives the countdown in the RSVP reminder — see lib/rsvp-deadline. */
  rsvpDeadline?: string
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

// Shared Honeymoon Fund call-to-action, appended to the guest-facing RSVP
// confirmations (yes + no) so wording and styling stay identical. Absolute URL so
// it never renders relative in an email client.
// Absolute, because an email has no origin to resolve a relative path against.
function siteUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SITE_URL || 'https://walters-pierce-wedding.com'}${path}`
}

// The gold-on-green button every guest-facing call to action uses. `htmlLabel` is
// interpolated as-is so a caller can pass an entity (the registry's gift emoji);
// callers pass literals, never guest input.
function ctaButton(path: string, htmlLabel: string, textLabel: string): { html: string; text: string } {
  const url = siteUrl(path)
  const html = `<p style="text-align:center; margin:24px 0 4px;"><a href="${url}" style="display:inline-block; background:#00330a; color:#D4AF37; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:bold;">${htmlLabel}</a></p>`
  const text = `\n\n${textLabel}: ${url}`
  return { html, text }
}

function registryCta(): { html: string; text: string } {
  return ctaButton('/registry', 'Visit our Honeymoon Fund &#127873;', 'Visit our Honeymoon Fund')
}

export function generateRsvpYesEmail(
  firstName: string,
  details: WeddingDetails,
  guestCount?: number | null
): Rendered {
  const name = escapeHtml(firstName || 'there')
  const cta = registryCta()
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
    <p style="margin-top:0;"><strong>${venueName}</strong>${venueLinesHtml ? `<br>${venueLinesHtml}` : ''}</p>
    ${cta.html}`
  const text = `Hi ${firstName || 'there'}! Thank you so much for your RSVP! We are so happy to hear that `
    + `you'll be there to share our special day with us. Get ready for an amazing night!\n\n`
    + (countSentence ? `${countSentence}\n\n` : '')
    + `Our venue is\n${details.venueName || 'our venue'}${venueLinesText ? `\n${venueLinesText}` : ''}\n`
    + cta.text
  return { subject: 'Thank you for your RSVP — Emme & Connor', html: wrap('We can’t wait to celebrate!', body), text }
}

export function generateRsvpNoEmail(firstName: string): Rendered {
  const name = escapeHtml(firstName || 'there')
  const cta = registryCta()
  const body = `<p>Hi ${name}, thank you for updating your RSVP! We are so sorry to miss you on our
    special day, but we truly appreciate you letting us know.</p>
    ${cta.html}`
  const text = `Hi ${firstName || 'there'}, thank you for updating your RSVP! We are so sorry to miss you on our special day, `
    + `but we truly appreciate you letting us know.`
    + cta.text
  return { subject: 'Thank you for your RSVP — Emme & Connor', html: wrap('We’ll miss you', body), text }
}

// The nudge for a guest who hasn't answered yet — Nicolle's "RSVP - unknown".
// Her wording: "Just a gentle reminder that you have [X] days to reply to the RSVP
// before your response is listed as no."
//
// `daysLeft` is counted by lib/rsvp-deadline in the wedding's timezone, and the
// deadline is spelled out beside it so the note doesn't rely on the reader working
// out what "3 days" lands on. Callers must not send this once the deadline has
// passed — "you have -2 days" is not a note you send anyone, and the send route
// refuses instead.
export function generateRsvpReminderEmail(
  firstName: string,
  daysLeft: number,
  deadline: string
): Rendered {
  const name = escapeHtml(firstName || 'there')
  const window = daysLeft <= 0
    ? 'today is the last day'
    : `you have <strong>${daysLeftPhrase(daysLeft)}</strong>`
  const windowText = daysLeft <= 0 ? 'today is the last day' : `you have ${daysLeftPhrase(daysLeft)}`
  const by = escapeHtml(formatDeadline(deadline))

  const body = `<p>Hi ${name},</p>
    <p>Just a gentle reminder that ${window} to reply to your RSVP. We need every
    answer in by <strong>${by}</strong> — after that we have to give the caterer our
    final numbers, and anyone we haven't heard from will be counted as unable to
    come.</p>
    <p>It only takes a moment, and we'd so love to have you there.</p>
    <p style="text-align:center; margin: 24px 0;">
      <a href="https://walters-pierce-wedding.com/rsvp" class="cta-button"
         style="background:#00330a; color:#D4AF37; padding:12px 24px; border-radius:999px; text-decoration:none; display:inline-block;">
        Reply to your RSVP
      </a>
    </p>`

  const text = `Hi ${firstName || 'there'},\n\n`
    + `Just a gentle reminder that ${windowText} to reply to your RSVP. We need every answer in by `
    + `${formatDeadline(deadline)} — after that we have to give the caterer our final numbers, and anyone `
    + `we haven't heard from will be counted as unable to come.\n\n`
    + `It only takes a moment, and we'd so love to have you there.\n\n`
    + `Reply here: https://walters-pierce-wedding.com/rsvp\n\n`
    + `With love,\nEmme & Connor`

  return {
    subject: daysLeft <= 0
      ? 'Last day to RSVP — Emme & Connor'
      : `A gentle reminder — ${daysLeftPhrase(daysLeft)} left to RSVP`,
    html: wrap('We’d love an answer', body),
    text,
  }
}

// `allowedCount` is the number of guests Nicolle has approved for this party
// (their reservedSeats on record). Worded to fit an unmatched guest who never had
// an invitation with a pre-set count — she sets the number in the portal, then sends.
export function generateRsvpOverCountEmail(
  firstName: string,
  rsvpdCount: number | null,
  allowedCount: number | null
): Rendered {
  const name = escapeHtml(firstName || 'there')
  const submitted = rsvpdCount ?? 0
  const guestWord = (n: number) => (n === 1 ? 'guest' : 'guests')
  const lead = submitted > 0
    ? `We noticed your RSVP included ${submitted} ${guestWord(submitted)}, but due to our intimate guest count and venue space,`
    : `Due to our intimate guest count and venue space,`
  const allowedPhrase = allowedCount != null
    ? `we're only able to allow ${allowedCount} ${guestWord(allowedCount)}`
    : `we're only able to allow a limited number of guests`
  const body = `
    <p>Hi ${name}! We are so looking forward to having you at our wedding. ${lead}
    ${allowedPhrase}. Let us know if you can still celebrate with us within that count—we'd
    love to have you!</p>`
  const text = `Hi ${firstName || 'there'}! We are so looking forward to having you at our wedding. `
    + `${lead} ${allowedPhrase}. `
    + `Let us know if you can still celebrate with us within that count—we'd love to have you!`
  return { subject: 'A quick note about your RSVP — Emme & Connor', html: wrap('A quick note about your RSVP', body), text }
}

// The date Nicolle owes Blackstone Rivers Ranch and Serendipity their final
// numbers ("9-10 (next Thursday)"). It is in the guest-facing copy because a
// request to "update your RSVP" with no date gets actioned the week after the
// caterer is already committed. Distinct from DEFAULT_RSVP_DEADLINE, which is when
// a non-answer becomes a no — this one is when the numbers stop being changeable.
// Spelled out by formatDeadline so the weekday is derived, not typed from memory.
export const FINAL_HEADCOUNT_DEADLINE_DATE = '2026-09-10'
export const FINAL_HEADCOUNT_DEADLINE = formatDeadline(FINAL_HEADCOUNT_DEADLINE_DATE)

/**
 * The wording Nicolle sees pre-filled in the editor. Kept out of the render body
 * so the form and the email can never drift: the box she edits is seeded from
 * these exact strings, and leaving one untouched sends this text verbatim.
 */
export const FINAL_HEADCOUNT_DEFAULTS = {
  subject: 'A quick check on your RSVP — Emme & Connor',
  heading: 'Almost two weeks to go!',
  intro: "Our wedding is almost two weeks away and we can't wait to celebrate with you!",
  ask:
    'If anything pops up and you can no longer attend, please update your RSVP on '
    + `our website by ${FINAL_HEADCOUNT_DEADLINE}.`,
} as const

export interface FinalHeadcountContent {
  subject?: string
  heading?: string
  intro?: string
  ask?: string
  includeCount?: boolean
}

// Her text arrives as plain prose typed into a textarea, so blank lines mean new
// paragraphs and every character is escaped. She is editing a template that goes
// to 63 different people — it must not be able to carry markup into their inboxes.
function prose(text: string, greeting?: string): string {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  if (blocks.length === 0) return greeting ? `<p>${greeting}</p>` : ''
  return blocks
    .map((block, i) => {
      const inner = escapeHtml(block).replace(/\n/g, '<br>')
      return `<p>${i === 0 && greeting ? `${greeting} ` : ''}${inner}</p>`
    })
    .join('\n    ')
}

/**
 * Sent to everyone already on record as attending, a fortnight out (Nicolle,
 * 2026-09-04: "prompt everyone to consider what they RSVP'd in light of any
 * changes in their lives").
 *
 * It quotes the count back because that is the number being confirmed — asking
 * someone to "check your RSVP" without showing it makes them go and look, and
 * most won't. Same reasoning as the RSVP-Yes confirmation, which already does it.
 * A party with no count on record simply doesn't get the sentence; inventing a
 * number here would be worse than omitting it, since the guest may correct
 * themselves against it.
 */
export function generateFinalHeadcountEmail(
  firstName: string,
  rsvpdCount: number | null,
  content: FinalHeadcountContent = {}
): Rendered {
  const subject = content.subject?.trim() || FINAL_HEADCOUNT_DEFAULTS.subject
  const heading = content.heading?.trim() || FINAL_HEADCOUNT_DEFAULTS.heading
  const intro = content.intro?.trim() || FINAL_HEADCOUNT_DEFAULTS.intro
  const ask = content.ask?.trim() || FINAL_HEADCOUNT_DEFAULTS.ask
  const includeCount = content.includeCount !== false

  const name = escapeHtml(firstName || 'there')
  const count = includeCount && rsvpdCount != null && rsvpdCount > 0 ? rsvpdCount : null
  const guestWord = count === 1 ? 'guest' : 'guests'
  const countSentence = count ? `We have you down for ${count} ${guestWord}.` : ''

  const body = `
    ${prose(intro, `Hi ${name}!`)}
    ${count ? `<p>We have you down for <strong>${count}</strong> ${guestWord}.</p>` : ''}
    ${prose(ask)}`
  const text = `Hi ${firstName || 'there'}! ${intro}\n\n`
    + (countSentence ? `${countSentence}\n\n` : '')
    + ask
  return { subject, html: wrap(heading, body), text }
}

// Internal heads-up to the coordinator (Nicolle) when a Honeymoon Fund gift lands,
// so she has who/how-much/message on hand for Emme's thank-you notes.
export function generateGiftNotificationEmail(data: {
  name: string
  amount: number
  tierTitle: string
  message?: string | null
}): Rendered {
  const donor = data.name || 'A guest'
  const amount = `$${data.amount.toLocaleString('en-US')}`
  const rows: Array<[string, string]> = [
    ['From', donor],
    ['Amount', amount],
    ['Toward', data.tierTitle || 'the Honeymoon Fund'],
    ['Message', data.message?.trim() || '—'],
    ['Received', new Date().toLocaleString('en-US', { timeZone: 'America/Denver' })],
  ]
  const subject = `New Honeymoon Fund gift: ${amount} from ${donor}`
  const html = wrap('New Honeymoon Fund gift', `
    <table style="width:100%; border-collapse: collapse;">${rows
      .map(([k, v]) => `<tr><td style="padding:6px 8px; color:#00330a; font-weight:bold; vertical-align:top;">${k}</td><td style="padding:6px 8px;">${escapeHtml(v)}</td></tr>`)
      .join('')}</table>`)
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n')
  return { subject, html, text }
}

export type ThankYouGift = {
  /** Blank/0 means a present with no cash value — no figure is ever printed. */
  amount?: number | null
  /** A Honeymoon Fund tier, or what Nicolle typed ("beautiful cake serving set"). */
  label?: string | null
}

// "$50 toward Buy us Coffee" / "$50" / "beautiful cake serving set" / ""
function giftPhrase(gift: ThankYouGift, bold: (s: string) => string): string {
  const hasAmount = typeof gift.amount === 'number' && gift.amount > 0
  const label = (gift.label ?? '').trim()
  if (hasAmount) {
    const amount = bold(`$${(gift.amount as number).toLocaleString('en-US')}`)
    return label ? `${amount} toward ${bold(label)}` : amount
  }
  return label ? bold(label) : ''
}

// "A" / "A, as well as B" / "A, B, as well as C"
function joinGifts(phrases: string[]): string {
  if (phrases.length <= 1) return phrases[0] ?? ''
  return `${phrases.slice(0, -1).join(', ')}, as well as ${phrases[phrases.length - 1]}`
}

/**
 * The closing line, which turns on whether the giver will actually be there.
 *
 * Nicolle, 2026-09-13, gave the regrets wording verbatim — it is hers, not a
 * paraphrase, so edit it only on her say-so. Someone who has already told us they
 * can't come should not be thanked with "we can't wait to celebrate with you";
 * that reads as though nobody opened their RSVP.
 */
export const THANK_YOU_CLOSING = {
  attending:
    "We can't wait to celebrate with you — and we'll be sure to share a photo of us enjoying it!",
  notAttending:
    "We'll miss you on our big day! We're so sorry you can't be there to celebrate "
    + 'with us, but keep an eye out for photos soon!',
} as const

/**
 * Takes a list so one note can acknowledge everything a person gave (Nicolle:
 * "it should be a combined thank you note" — Aunt Marilyn gave a cake serving set
 * AND cash). One gift keeps the original single-gift wording, so the note Stripe
 * sends automatically is unchanged.
 *
 * Amounts are optional throughout: a present has no meaningful figure, and "your
 * generous gift of $0 toward crystal bowl" is not a note you send your grandmother.
 *
 * `attending` picks the closing line. Only an explicit `false` — someone on record
 * as not coming — gets the regrets wording. Unknown (null/undefined, i.e. no RSVP
 * yet, or a Stripe gift we could not match to a guest) keeps the celebratory line:
 * a gift often arrives before the RSVP does, and telling someone "sorry you can't
 * be there" when they simply haven't answered yet is the worse of the two errors.
 */
export function generateRegistryThankYouEmail(data: {
  name: string
  gifts: ThankYouGift[]
  attending?: boolean | null
}): Rendered {
  const name = escapeHtml(data.name)
  const htmlPhrases = data.gifts
    .map((g) => giftPhrase(g, (s) => `<strong>${escapeHtml(s)}</strong>`))
    .filter(Boolean)
  const textPhrases = data.gifts.map((g) => giftPhrase(g, (s) => s)).filter(Boolean)

  // With several gifts the list carries the sentence; with one, keep the original
  // "your generous gift of X" phrasing. Nothing identifiable falls back to "gift".
  const sentence = (phrases: string[]) => {
    if (phrases.length === 0) return 'your generous gift'
    if (phrases.length === 1) return `your generous gift of ${phrases[0]}`
    return `your generous gifts — ${joinGifts(phrases)}`
  }

  // One string for both bodies, so the HTML and plain-text notes cannot drift apart.
  const closing =
    data.attending === false ? THANK_YOU_CLOSING.notAttending : THANK_YOU_CLOSING.attending

  const subject = `Thank you for your gift, ${data.name}!`
  const body = `
    <p>Dear ${name},</p>
    <p>Thank you so much for ${sentence(htmlPhrases)}. It means the world to us as we
    get ready for our honeymoon in Ireland.</p>
    <p>${closing}</p>
    <p style="margin-top: 24px;">With love and gratitude,<br><strong>Emme &amp; Connor</strong></p>`
  const html = wrap('A heartfelt thank you', body)
  const text = `Dear ${data.name},\n\nThank you so much for ${sentence(textPhrases)}. `
    + `It means the world to us as we get ready for our honeymoon in Ireland. ${closing}\n\n`
    + `With love and gratitude,\nEmme & Connor\nwalters-pierce-wedding.com`
  return { subject, html, text }
}
