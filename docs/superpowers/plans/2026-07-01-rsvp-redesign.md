# RSVP Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace code-based RSVP with a shared-QR, accept-all-and-flag flow; all guest-facing email gated through a new admin panel, sent via Resend.

**Architecture:** Core logic lives in `lib/` (blocklist, rsvp processing, email) so it is unit-testable; API routes are thin wrappers; the admin panel is one new page + two API routes. The wedding-details gating subsystem is deleted, not fixed. Spec: `docs/superpowers/specs/2026-07-01-rsvp-redesign-design.md`.

**Tech Stack:** Next.js 15 (App Router), Prisma/PostgreSQL (Railway), Resend SDK (installed), zod (installed), svix (to install), Jest + babel-jest (existing config; `@/lib/*` maps to `lib/*`).

**Working branch:** `fix/critical-rsvp-session` (already checked out).

**Environment facts:** `RESEND_API_KEY` + `FROM_EMAIL` (`noreply@walters-pierce-wedding.com`) are live in `.env.local` and Railway; domain verified in Resend. Notification recipient: `lnawalters@protonmail.com` (Nicolle). Gated sender: `Wedding Coordinator <coordinator@walters-pierce-wedding.com>`.

---

### Task 1: Schema migration — Guest and EmailLog fields

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields to Guest model**

In `prisma/schema.prisma`, inside `model Guest`, after the `attending Boolean?` line, add:

```prisma
  partySize           Int?       @map("party_size")
  songRequest         String?    @map("song_request")
  source              String     @default("imported")
```

- [ ] **Step 2: Add fields to EmailLog model**

Inside `model EmailLog`, after `clickedAt`, add:

```prisma
  bouncedAt         DateTime? @map("bounced_at")
  resendMessageId   String?   @map("resend_message_id")
```

- [ ] **Step 3: Create and apply the migration**

Run: `npx prisma migrate dev --name rsvp_redesign_fields`
Expected: "Your database is now in sync with your schema" and a new folder under `prisma/migrations/`.
(This runs against the DATABASE_URL in `.env` — the Railway database. The columns are nullable/defaulted, so this is non-breaking.)

- [ ] **Step 4: Regenerate the client and typecheck the schema change**

Run: `npx prisma generate && node -e "const {PrismaClient}=require('@prisma/client'); console.log('ok')"`
Expected: `ok`

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat(db): add partySize, songRequest, source to Guest; bounce/resend fields to EmailLog"
```

---

### Task 2: Blocklist library (TDD)

**Files:**
- Create: `lib/blocklist.ts`
- Create: `lib/__tests__/blocklist.test.ts`
- Create: `scripts/seed-blocklist.mjs`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/blocklist.test.ts`:

```ts
import { normalizeName, isBlockedName } from '@/lib/blocklist'

describe('normalizeName', () => {
  it('lowercases, strips punctuation/digits, collapses whitespace', () => {
    expect(normalizeName('  Thomas   WALTERS ')).toBe('thomas walters')
    expect(normalizeName("Marci-Ann O'Harris3")).toBe('marci ann o harris')
  })
})

describe('isBlockedName', () => {
  const blocklist = [
    'marci harris', 'marciann harris', 'marci ann harris',
    'montana harris', 'tom walters', 'thomas walters',
  ]
  it.each([
    ['Marci', 'Harris'],
    ['MarciAnn', 'Harris'],
    ['marci ann', 'HARRIS'],
    ['Montana', 'Harris'],
    ['Tom', 'Walters'],
    ['  Thomas ', ' Walters '],
  ])('blocks %s %s', (first, last) => {
    expect(isBlockedName(first, last, blocklist)).toBe(true)
  })
  it.each([
    ['Marcus', 'Harris'],
    ['Tom', 'Waters'],
    ['Nicolle', 'Walters'],
  ])('does not block %s %s', (first, last) => {
    expect(isBlockedName(first, last, blocklist)).toBe(false)
  })
  it('returns false for empty blocklist', () => {
    expect(isBlockedName('Tom', 'Walters', [])).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/__tests__/blocklist.test.ts`
Expected: FAIL — cannot find module `@/lib/blocklist`

- [ ] **Step 3: Write the implementation**

Create `lib/blocklist.ts`:

```ts
import { prisma } from './prisma'

export const BLOCKLIST_SETTING_KEY = 'rsvp_blocklist'

// Lowercase, replace every non-letter with a space, collapse runs of spaces.
// "MarciAnn" stays "marciann" (no internal split), "Marci-Ann" becomes "marci ann" —
// which is why the seeded list carries both spellings.
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isBlockedName(firstName: string, lastName: string, blocklist: string[]): boolean {
  const full = normalizeName(`${firstName} ${lastName}`)
  if (!full) return false
  return blocklist.some((entry) => normalizeName(entry) === full)
}

export async function getBlocklist(): Promise<string[]> {
  const row = await prisma.setting.findUnique({ where: { key: BLOCKLIST_SETTING_KEY } })
  if (!row?.value) return []
  try {
    const parsed = JSON.parse(row.value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/__tests__/blocklist.test.ts`
Expected: PASS (all cases)

- [ ] **Step 5: Create the seed script**

Create `scripts/seed-blocklist.mjs`:

```js
// Seeds/updates the RSVP blocklist Setting row. Idempotent.
// Usage: node scripts/seed-blocklist.mjs
import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

config({ path: '.env.local' })
const prisma = new PrismaClient()

const BLOCKLIST = [
  'marci harris',
  'marciann harris',
  'marci ann harris',
  'montana harris',
  'tom walters',
  'thomas walters',
]

const row = await prisma.setting.upsert({
  where: { key: 'rsvp_blocklist' },
  create: {
    key: 'rsvp_blocklist',
    value: JSON.stringify(BLOCKLIST),
    valueType: 'json',
    description: 'Normalized full names that cannot RSVP (managed discreetly)',
  },
  update: { value: JSON.stringify(BLOCKLIST) },
})
console.log('Blocklist seeded:', JSON.parse(row.value).length, 'entries')
await prisma.$disconnect()
```

- [ ] **Step 6: Run the seed script**

Run: `node scripts/seed-blocklist.mjs`
Expected: `Blocklist seeded: 6 entries`

- [ ] **Step 7: Commit**

```bash
git add lib/blocklist.ts lib/__tests__/blocklist.test.ts scripts/seed-blocklist.mjs
git commit -m "feat: RSVP name blocklist with Setting-backed storage"
```

---

### Task 3: Purge test fixtures and import the real guest list

**Files:**
- Create: `scripts/import-guests.mjs`
- Exists: `data/mailerlite_subscribers.csv` (59 unique emails, committed)

- [ ] **Step 1: Write the import script**

Create `scripts/import-guests.mjs`:

```js
// One-time: purge test-fixture guests, import MailerLite save-the-date emails
// as source='imported' with empty names (names fill in at RSVP time).
// Usage: node scripts/import-guests.mjs
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'

config({ path: '.env.local' })
const prisma = new PrismaClient()

// The 10 fixture rows verified in production on 2026-07-01:
// 9 @example.com addresses + testy@gmail.com
const fixtures = await prisma.guest.findMany({
  where: { OR: [{ email: { endsWith: '@example.com' } }, { email: 'testy@gmail.com' }] },
  select: { id: true, email: true },
})
const fixtureIds = fixtures.map((g) => g.id)
if (fixtureIds.length) {
  await prisma.emailLog.deleteMany({ where: { guestId: { in: fixtureIds } } })
  await prisma.plusOne.deleteMany({ where: { guestId: { in: fixtureIds } } })
  const del = await prisma.guest.deleteMany({ where: { id: { in: fixtureIds } } })
  console.log('Purged fixtures:', del.count, fixtures.map((g) => g.email).join(', '))
}

const lines = readFileSync('data/mailerlite_subscribers.csv', 'utf8').trim().split('\n').slice(1)
const emails = [...new Set(lines.map((l) => l.split(',')[0].trim().toLowerCase()).filter(Boolean))]

let created = 0
for (const email of emails) {
  const existing = await prisma.guest.findUnique({ where: { email } })
  if (existing) continue
  await prisma.guest.create({
    data: { email, firstName: '', lastName: '', source: 'imported' },
  })
  created++
}
const total = await prisma.guest.count()
console.log(`Imported ${created} new guests. Guest table total: ${total}`)
await prisma.$disconnect()
```

- [ ] **Step 2: Run it**

Run: `node scripts/import-guests.mjs`
Expected: `Purged fixtures: 10 ...` then `Imported 59 new guests. Guest table total: 59`

- [ ] **Step 3: Verify idempotency (run again)**

Run: `node scripts/import-guests.mjs`
Expected: no purge line (or 0), `Imported 0 new guests. Guest table total: 59`

- [ ] **Step 4: Commit**

```bash
git add scripts/import-guests.mjs
git commit -m "feat: guest import script — purge fixtures, import save-the-date list"
```

---

### Task 4: Rewrite lib/email.ts on Resend (honest logging)

**Files:**
- Modify: `lib/email.ts` (replace the MailerLite section; KEEP all existing `generate*` exports — they are imported by 4 admin routes)
- Create: `lib/__tests__/email-send.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/email-send.test.ts`:

```ts
import { sendEmail } from '@/lib/email'

jest.mock('@/lib/prisma', () => ({ prisma: { emailLog: { create: jest.fn() } } }))

describe('sendEmail', () => {
  const OLD_ENV = process.env
  afterEach(() => { process.env = OLD_ENV })

  it('fails honestly when RESEND_API_KEY is missing', async () => {
    process.env = { ...OLD_ENV }
    delete process.env.RESEND_API_KEY
    const result = await sendEmail({ to: 'x@y.com', subject: 's', html: '<p>h</p>' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/not configured/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/__tests__/email-send.test.ts`
Expected: FAIL — current implementation returns `{ success: true, messageId: 'mock-email-id' }` when unconfigured.

- [ ] **Step 3: Replace the sending layer in lib/email.ts**

In `lib/email.ts`: delete the `getMailerLite` function (lines 1–17) and the entire body of `sendEmail` (lines 34–71). Keep the `EmailTemplate` and `RSVPConfirmationData` interfaces and every `generate*` function below untouched. Add at the top:

```ts
import { Resend } from 'resend'
import { prisma } from './prisma'

export const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'lnawalters@protonmail.com'
export const COORDINATOR_FROM = 'Wedding Coordinator <coordinator@walters-pierce-wedding.com>'

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
```

New `sendEmail` (same exported name; second parameter is new and optional so existing callers compile unchanged):

```ts
export interface SendOptions {
  from?: string
  replyTo?: string
}

export async function sendEmail(
  { to, subject, html, text }: EmailTemplate,
  opts: SendOptions = {}
) {
  const apiKey = process.env.RESEND_API_KEY
  const from = opts.from || process.env.FROM_EMAIL
  if (!apiKey || !from) {
    console.error('Email NOT sent (service not configured):', subject, '->', to)
    return { success: false as const, error: 'Email service not configured' }
  }
  try {
    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text: text || htmlToText(html),
      replyTo: opts.replyTo,
    })
    if (error) {
      console.error('Resend send failed:', error.message)
      return { success: false as const, error: error.message }
    }
    return { success: true as const, messageId: data?.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Resend send threw:', message)
    return { success: false as const, error: message }
  }
}

export async function logEmail(entry: {
  guestId?: string | null
  emailType: string
  recipientEmail: string
  subject: string
  status: 'sent' | 'failed'
  resendMessageId?: string | null
}) {
  try {
    await prisma.emailLog.create({
      data: {
        guestId: entry.guestId ?? null,
        emailType: entry.emailType,
        recipientEmail: entry.recipientEmail,
        subject: entry.subject,
        status: entry.status,
        resendMessageId: entry.resendMessageId ?? null,
      },
    })
  } catch (err) {
    console.error('Failed to write email log:', err)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/__tests__/email-send.test.ts`
Expected: PASS

- [ ] **Step 5: Verify no caller broke**

Run: `npx jest lib/__tests__/ && grep -rn "mailerlite" lib/ app/ --include="*.ts" -i`
Expected: existing email tests pass (fix any that asserted the old mock behavior — update assertions to the new honest-failure contract); grep returns nothing.

Run: `npm uninstall @mailerlite/mailerlite-nodejs`

- [ ] **Step 6: Commit**

```bash
git add lib/email.ts lib/__tests__/email-send.test.ts package.json package-lock.json
git commit -m "feat(email): replace MailerLite stub with real Resend sending + honest logs"
```

---

### Task 5: Four new email templates (TDD)

**Files:**
- Create: `lib/email-templates.ts`
- Create: `lib/__tests__/email-templates.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/email-templates.test.ts`:

```ts
import {
  generateRsvpNotificationEmail,
  generateBlockedAttemptEmail,
  generateVenueDetailsEmail,
  generateGraciousRegretsEmail,
} from '@/lib/email-templates'

const submission = {
  firstName: 'Jane', lastName: 'Smith', email: 'jane@x.com',
  attending: true, partySize: 2,
  dietaryRestrictions: 'vegetarian', songRequest: 'September - EWF',
}

describe('generateRsvpNotificationEmail', () => {
  it('includes all response fields and the matched flag in subject', () => {
    const t = generateRsvpNotificationEmail({ ...submission, matched: true })
    expect(t.subject).toContain('matched')
    expect(t.subject).toContain('Jane Smith')
    for (const s of ['jane@x.com', 'party of 2', 'vegetarian', 'September - EWF']) {
      expect(t.html).toContain(s)
    }
    expect(t.text).toContain('jane@x.com')
  })
  it('marks unmatched yeses for review', () => {
    const t = generateRsvpNotificationEmail({ ...submission, matched: false })
    expect(t.subject.toLowerCase()).toContain('unmatched')
    expect(t.html.toLowerCase()).toContain('not on the original list')
  })
  it('handles declines', () => {
    const t = generateRsvpNotificationEmail({ ...submission, attending: false, matched: true })
    expect(t.subject).toContain('declined')
  })
})

describe('generateBlockedAttemptEmail', () => {
  it('is discreet but complete', () => {
    const t = generateBlockedAttemptEmail(submission)
    expect(t.subject.toLowerCase()).toContain('blocked')
    expect(t.html).toContain('Jane Smith')
    expect(t.html).toContain('jane@x.com')
  })
})

describe('generateVenueDetailsEmail', () => {
  it('renders guest name and all wedding details', () => {
    const t = generateVenueDetailsEmail('Jane', {
      date: 'September 12, 2026', time: '4:00 PM',
      venueName: 'The Grove', venueAddress: '1 Grove Ln, Denver CO',
    })
    for (const s of ['Jane', 'September 12, 2026', '4:00 PM', 'The Grove', '1 Grove Ln, Denver CO']) {
      expect(t.html).toContain(s)
      expect(t.text).toContain(s)
    }
  })
})

describe('generateGraciousRegretsEmail', () => {
  it('renders guest name, never mentions venue or date', () => {
    const t = generateGraciousRegretsEmail('Jane')
    expect(t.html).toContain('Jane')
    expect(t.html.toLowerCase()).not.toContain('venue')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/__tests__/email-templates.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the templates**

Create `lib/email-templates.ts`. All templates return `{ subject, html, text }` (the `to` is supplied at send time). Shared wrapper keeps the forest-green/gold theme:

```ts
interface Rendered { subject: string; html: string; text: string }

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
  data: RsvpSubmissionSummary & { matched: boolean }
): Rendered {
  const name = `${data.firstName} ${data.lastName}`
  const verdict = data.attending ? 'YES' : 'declined'
  const matchTag = data.matched ? 'matched' : 'UNMATCHED'
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
  const html = wrap('New RSVP received', `
    <table style="width:100%; border-collapse: collapse;">${rows
      .map(([k, v]) => `<tr><td style="padding:6px 8px; color:#00330a; font-weight:bold; vertical-align:top;">${k}</td><td style="padding:6px 8px;">${v}</td></tr>`)
      .join('')}</table>`)
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n')
  return { subject, html, text }
}

export function generateBlockedAttemptEmail(data: RsvpSubmissionSummary): Rendered {
  const name = `${data.firstName} ${data.lastName}`
  const subject = `Blocked RSVP attempt: ${name}`
  const html = wrap('Blocked RSVP attempt', `
    <p>An RSVP was submitted by a name on the private list. Nothing was saved and no reply was sent — the submitter saw the normal thank-you screen.</p>
    <p><strong>${name}</strong> &lt;${data.email}&gt;<br/>
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
  const greeting = guestFirstName ? `Dear ${guestFirstName},` : 'Hello,'
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
  const text = `${greeting}\n\nThank you for your RSVP — here is everything you need:\n\nDate: ${d.date}\nTime: ${d.time}\nVenue: ${d.venueName}, ${d.venueAddress}\n\nIf anything changes with your plans, just reply to this email.\n\nWith love,\nEmme & Connor`
  return { subject, html, text }
}

export function generateGraciousRegretsEmail(guestFirstName: string): Rendered {
  const subject = `Thank you for your RSVP — Emme & Connor`
  const greeting = guestFirstName ? `Dear ${guestFirstName},` : 'Hello,'
  const html = wrap('Thank you', `
    <p>${greeting}</p>
    <p>Thank you so much for responding, and for the kindness of wanting to celebrate with Emme and Connor.</p>
    <p>Because of space, the celebration is limited to a small guest list, and we're so sorry we aren't able to extend the invitation further. It means a great deal that you thought of them.</p>
    <p>The couple would love to share photos and stories after the big day.</p>
    <p style="margin-bottom:0;">With warm thanks,<br/>The Walters &amp; Pierce Families</p>`)
  const text = `${greeting}\n\nThank you so much for responding, and for the kindness of wanting to celebrate with Emme and Connor.\n\nBecause of space, the celebration is limited to a small guest list, and we're so sorry we aren't able to extend the invitation further. It means a great deal that you thought of them.\n\nThe couple would love to share photos and stories after the big day.\n\nWith warm thanks,\nThe Walters & Pierce Families`
  return { subject, html, text }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/__tests__/email-templates.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/email-templates.ts lib/__tests__/email-templates.test.ts
git commit -m "feat(email): notification, blocked-attempt, venue-details, gracious-regrets templates"
```

---

### Task 6: RSVP core logic — lib/rsvp.ts (TDD)

**Files:**
- Create: `lib/rsvp.ts`
- Create: `lib/__tests__/rsvp.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/rsvp.test.ts`:

```ts
import { processRsvpSubmission, rsvpSchema } from '@/lib/rsvp'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    guest: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    auditLog: { create: jest.fn() },
    emailLog: { create: jest.fn() },
    setting: { findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-1' }),
  logEmail: jest.fn(),
  NOTIFY_EMAIL: 'notify@test',
  COORDINATOR_FROM: 'Coordinator <c@test>',
}))

const mockPrisma = prisma as jest.Mocked<any>

const input = {
  firstName: 'Jane', lastName: 'Smith', email: 'Jane@X.com',
  attending: true, partySize: 2, dietaryRestrictions: '', songRequest: 'ABBA',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPrisma.setting.findUnique.mockResolvedValue({
    value: JSON.stringify(['tom walters']),
  })
})

describe('rsvpSchema', () => {
  it('requires partySize when attending', () => {
    const r = rsvpSchema.safeParse({ ...input, partySize: undefined })
    expect(r.success).toBe(false)
  })
  it('allows missing partySize when declining', () => {
    const r = rsvpSchema.safeParse({ ...input, attending: false, partySize: undefined })
    expect(r.success).toBe(true)
  })
})

describe('processRsvpSubmission', () => {
  it('short-circuits blocked names: audit log, notification, no guest write', async () => {
    const result = await processRsvpSubmission({ ...input, firstName: 'Tom', lastName: 'Walters' })
    expect(result.outcome).toBe('blocked')
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'rsvp_blocked' }) })
    )
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(mockPrisma.guest.findUnique).not.toHaveBeenCalled()
    expect(mockPrisma.guest.create).not.toHaveBeenCalled()
  })

  it('updates a matched guest by lowercased email and reports matched=true', async () => {
    mockPrisma.guest.findUnique.mockResolvedValue({
      id: 'g1', email: 'jane@x.com', firstName: '', lastName: '', source: 'imported',
    })
    mockPrisma.guest.update.mockResolvedValue({ id: 'g1' })
    const result = await processRsvpSubmission(input)
    expect(result).toEqual({ outcome: 'saved', matched: true })
    expect(mockPrisma.guest.findUnique).toHaveBeenCalledWith({ where: { email: 'jane@x.com' } })
    const updateArg = mockPrisma.guest.update.mock.calls[0][0]
    expect(updateArg.data.firstName).toBe('Jane') // fills empty name on file
    expect(updateArg.data.partySize).toBe(2)
  })

  it('creates an unmatched guest with source=self_rsvp', async () => {
    mockPrisma.guest.findUnique.mockResolvedValue(null)
    mockPrisma.guest.create.mockResolvedValue({ id: 'g2' })
    const result = await processRsvpSubmission(input)
    expect(result).toEqual({ outcome: 'saved', matched: false })
    expect(mockPrisma.guest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ source: 'self_rsvp', email: 'jane@x.com' }) })
    )
  })

  it('still saves the RSVP if the notification email throws', async () => {
    mockPrisma.guest.findUnique.mockResolvedValue(null)
    mockPrisma.guest.create.mockResolvedValue({ id: 'g3' })
    ;(sendEmail as jest.Mock).mockRejectedValueOnce(new Error('resend down'))
    const result = await processRsvpSubmission(input)
    expect(result.outcome).toBe('saved')
  })

  it('nulls partySize when declining', async () => {
    mockPrisma.guest.findUnique.mockResolvedValue(null)
    mockPrisma.guest.create.mockResolvedValue({ id: 'g4' })
    await processRsvpSubmission({ ...input, attending: false, partySize: undefined })
    expect(mockPrisma.guest.create.mock.calls[0][0].data.partySize).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/__tests__/rsvp.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `lib/rsvp.ts`:

```ts
import { z } from 'zod'
import { prisma } from './prisma'
import { getBlocklist, isBlockedName } from './blocklist'
import { sendEmail, logEmail, NOTIFY_EMAIL } from './email'
import {
  generateRsvpNotificationEmail,
  generateBlockedAttemptEmail,
} from './email-templates'

export const rsvpSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(200),
    attending: z.boolean(),
    partySize: z.number().int().min(1).max(10).optional(),
    dietaryRestrictions: z.string().trim().max(1000).optional(),
    songRequest: z.string().trim().max(300).optional(),
  })
  .refine((d) => !d.attending || typeof d.partySize === 'number', {
    message: 'Please tell us how many are in your party',
    path: ['partySize'],
  })

export type RsvpInput = z.infer<typeof rsvpSchema>

export type RsvpResult = { outcome: 'blocked' } | { outcome: 'saved'; matched: boolean }

// Notification failures never fail the RSVP — the database row is the source
// of truth; email is a best-effort channel with an honest log.
async function notify(
  template: { subject: string; html: string; text: string },
  emailType: string,
  guestId?: string
) {
  try {
    const res = await sendEmail({ ...template, to: NOTIFY_EMAIL })
    await logEmail({
      guestId: guestId ?? null,
      emailType,
      recipientEmail: NOTIFY_EMAIL,
      subject: template.subject,
      status: res.success ? 'sent' : 'failed',
      resendMessageId: res.success ? res.messageId : null,
    })
  } catch (err) {
    console.error(`Notification (${emailType}) failed:`, err)
  }
}

export async function processRsvpSubmission(input: RsvpInput): Promise<RsvpResult> {
  const blocklist = await getBlocklist()
  if (isBlockedName(input.firstName, input.lastName, blocklist)) {
    await prisma.auditLog.create({
      data: {
        action: 'rsvp_blocked',
        entityType: 'guest',
        newValues: { ...input },
      },
    })
    await notify(generateBlockedAttemptEmail(input), 'blocked_attempt_notification')
    return { outcome: 'blocked' }
  }

  const email = input.email.trim().toLowerCase()
  const responseData = {
    attending: input.attending,
    partySize: input.attending ? input.partySize ?? 1 : null,
    dietaryRestrictions: input.dietaryRestrictions || null,
    songRequest: input.songRequest || null,
    rsvpReceivedAt: new Date(),
  }

  const existing = await prisma.guest.findUnique({ where: { email } })
  let guestId: string
  let matched: boolean
  if (existing) {
    matched = existing.source === 'imported'
    const updated = await prisma.guest.update({
      where: { id: existing.id },
      data: {
        ...responseData,
        firstName: existing.firstName || input.firstName,
        lastName: existing.lastName || input.lastName,
      },
    })
    guestId = updated.id
  } else {
    matched = false
    const created = await prisma.guest.create({
      data: {
        ...responseData,
        email,
        firstName: input.firstName,
        lastName: input.lastName,
        source: 'self_rsvp',
      },
    })
    guestId = created.id
  }

  await notify(
    generateRsvpNotificationEmail({ ...input, matched }),
    'rsvp_notification',
    guestId
  )
  return { outcome: 'saved', matched }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/__tests__/rsvp.test.ts`
Expected: PASS (all 7 cases)

- [ ] **Step 5: Commit**

```bash
git add lib/rsvp.ts lib/__tests__/rsvp.test.ts
git commit -m "feat: RSVP submission core — blocklist short-circuit, match-or-create, notify"
```

---

### Task 7: Rewire /api/rsvp/submit; delete the obsolete gating subsystem

**Files:**
- Modify: `app/api/rsvp/submit/route.ts` (full replacement)
- Delete: `app/api/rsvp/lookup/route.ts`
- Delete: `app/api/wedding-details/access-check/route.ts` (and its now-empty parent dir)
- Delete: `app/(public)/wedding-details/` (entire directory)

- [ ] **Step 1: Replace the submit route**

Replace the entire contents of `app/api/rsvp/submit/route.ts` with:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { rsvpSchema, processRsvpSubmission } from '@/lib/rsvp'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const parsed = rsvpSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid submission' },
      { status: 400 }
    )
  }

  try {
    // A blocked submission returns the identical response shape on purpose:
    // the submitter must not be able to distinguish it from a saved one.
    await processRsvpSubmission(parsed.data)
    return NextResponse.json({ ok: true, attending: parsed.data.attending })
  } catch (error) {
    console.error('RSVP submission failed:', error)
    return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 })
  }
}
```

Note what is gone: `cookies()` (the Next 15 sync-API bug), client-supplied `guestId`, plus-one writes, and the inline confirmation email.

- [ ] **Step 2: Delete the obsolete routes and page**

```bash
git rm -r app/api/rsvp/lookup app/api/wedding-details "app/(public)/wedding-details"
```

- [ ] **Step 3: Verify nothing still references them**

Run: `grep -rn "wedding-details\|rsvp/lookup\|rsvp-session" app components lib middleware.ts --include="*.ts" --include="*.tsx" | grep -v node_modules`
Expected: only hits inside `app/(public)/rsvp/page.tsx` (the old form — replaced in Task 8). If any other file references these, remove those references now.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(api): rewire /api/rsvp/submit to core logic; delete code-lookup and details gating"
```

---

### Task 8: Rebuild the public RSVP page

**Files:**
- Modify: `app/(public)/rsvp/page.tsx` (full replacement — the old two-step code-lookup form is obsolete)

- [ ] **Step 1: Replace the page**

Replace the entire contents of `app/(public)/rsvp/page.tsx` with a single-step form + result modal. Keep the visual language of the current page (forest green `#00330a`, gold `#D4AF37`, existing font classes):

```tsx
'use client'

import { useState } from 'react'

export default function RSVPPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [attending, setAttending] = useState<boolean | null>(null)
  const [partySize, setPartySize] = useState(1)
  const [dietaryRestrictions, setDietaryRestrictions] = useState('')
  const [songRequest, setSongRequest] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState<null | { attending: boolean }>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (attending === null) {
      setError('Please let us know whether you can join us.')
      return
    }
    setIsLoading(true)
    try {
      const response = await fetch('/api/rsvp/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          attending,
          partySize: attending ? partySize : undefined,
          dietaryRestrictions: dietaryRestrictions.trim() || undefined,
          songRequest: songRequest.trim() || undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Something went wrong — please try again.')
        return
      }
      setSubmitted({ attending })
    } catch {
      setError('Something went wrong — please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#FFFDF7] py-16 px-4">
      <div className="max-w-xl mx-auto">
        <h1 className="font-serif text-4xl text-center text-[#00330a] mb-2">RSVP</h1>
        <p className="text-center text-gray-600 mb-10">
          Emme &amp; Connor — September 2026
        </p>

        <form onSubmit={handleSubmit} className="space-y-6 bg-white border border-[#D4AF37]/40 rounded-lg p-8 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm text-[#00330a] font-medium">First name *</span>
              <input required value={firstName} onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full rounded border-gray-300 focus:border-[#00330a] focus:ring-[#00330a]" />
            </label>
            <label className="block">
              <span className="text-sm text-[#00330a] font-medium">Last name *</span>
              <input required value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full rounded border-gray-300 focus:border-[#00330a] focus:ring-[#00330a]" />
            </label>
          </div>

          <label className="block">
            <span className="text-sm text-[#00330a] font-medium">Email *</span>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border-gray-300 focus:border-[#00330a] focus:ring-[#00330a]" />
          </label>

          <fieldset>
            <legend className="text-sm text-[#00330a] font-medium mb-2">Will you be joining us? *</legend>
            <div className="flex gap-3">
              <button type="button" onClick={() => setAttending(true)}
                className={`flex-1 rounded border px-4 py-3 text-sm font-medium transition
                  ${attending === true ? 'bg-[#00330a] text-white border-[#00330a]' : 'border-gray-300 text-gray-700 hover:border-[#00330a]'}`}>
                Joyfully accepts
              </button>
              <button type="button" onClick={() => setAttending(false)}
                className={`flex-1 rounded border px-4 py-3 text-sm font-medium transition
                  ${attending === false ? 'bg-[#00330a] text-white border-[#00330a]' : 'border-gray-300 text-gray-700 hover:border-[#00330a]'}`}>
                Regretfully declines
              </button>
            </div>
          </fieldset>

          {attending === true && (
            <>
              <label className="block">
                <span className="text-sm text-[#00330a] font-medium">Number of guests (including you) *</span>
                <select value={partySize} onChange={(e) => setPartySize(Number(e.target.value))}
                  className="mt-1 w-full rounded border-gray-300 focus:border-[#00330a] focus:ring-[#00330a]">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm text-[#00330a] font-medium">Dietary restrictions</span>
                <textarea rows={2} value={dietaryRestrictions} onChange={(e) => setDietaryRestrictions(e.target.value)}
                  placeholder="Anything we should know for your party?"
                  className="mt-1 w-full rounded border-gray-300 focus:border-[#00330a] focus:ring-[#00330a]" />
              </label>
              <label className="block">
                <span className="text-sm text-[#00330a] font-medium">Favorite song — we&apos;ll try to play it! 🎵</span>
                <input value={songRequest} onChange={(e) => setSongRequest(e.target.value)}
                  placeholder="Song title and artist"
                  className="mt-1 w-full rounded border-gray-300 focus:border-[#00330a] focus:ring-[#00330a]" />
              </label>
            </>
          )}

          {error && <p className="text-red-700 text-sm">{error}</p>}

          <button type="submit" disabled={isLoading}
            className="w-full rounded bg-[#00330a] px-4 py-3 text-white font-medium hover:bg-[#004d10] disabled:opacity-60 transition">
            {isLoading ? 'Sending…' : 'Send RSVP'}
          </button>
        </form>
      </div>

      {submitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="dialog" aria-modal="true">
          <div className="max-w-md w-full rounded-lg bg-[#FFFDF7] border border-[#D4AF37] p-8 text-center shadow-xl">
            <h2 className="font-serif text-2xl text-[#00330a] mb-3">Thank you!</h2>
            {submitted.attending ? (
              <p className="text-gray-700">
                We look forward to celebrating with you. Watch your inbox for further
                information — the date, time, and venue are on their way.
              </p>
            ) : (
              <p className="text-gray-700">
                We would love to have you with us, but we understand you can&apos;t make it.
                You&apos;ll be missed!
              </p>
            )}
            <a href="/" className="inline-block mt-6 rounded bg-[#00330a] px-6 py-2 text-white text-sm hover:bg-[#004d10] transition">
              Back to the website
            </a>
          </div>
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev`, open `http://localhost:3000/rsvp`, submit:
1. An "accepts" RSVP with a CSV email (e.g. your own from the list) → expect the "watch your inbox" modal; a notification email arrives at `lnawalters@protonmail.com` with subject `RSVP YES (matched): …`.
2. A "declines" RSVP with an unknown email → "you'll be missed" modal; notification subject contains `(UNMATCHED)`.
3. A blocked name (use `Tom Walters` + any email) → normal modal, **no** guest row created (verify: `node -e "..."` count query or Prisma Studio), blocked-attempt email arrives.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/rsvp/page.tsx"
git commit -m "feat(rsvp): single-step shared-QR RSVP form with attending/declining modals"
```

---

### Task 9: Admin RSVPs API — bucket data + wedding details setting

**Files:**
- Create: `app/api/admin/rsvps/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/admin/rsvps/route.ts` (auth pattern copied from `app/api/admin/guests/route.ts`):

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Next.js route files may only export handlers/config — keep this const local.
const WEDDING_DETAILS_KEY = 'wedding_details'

const DEFAULT_DETAILS = {
  date: 'TBA', time: 'TBA', venueName: 'TBA', venueAddress: '',
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const [guests, detailsRow] = await Promise.all([
    prisma.guest.findMany({
      select: {
        id: true, firstName: true, lastName: true, email: true,
        attending: true, partySize: true, dietaryRestrictions: true,
        songRequest: true, source: true, rsvpReceivedAt: true,
        emailLogs: {
          where: { emailType: { in: ['gated_venue_details', 'gated_gracious_regrets'] } },
          select: { emailType: true, status: true, sentAt: true, openedAt: true, bouncedAt: true },
          orderBy: { sentAt: 'desc' },
        },
      },
      orderBy: [{ rsvpReceivedAt: 'desc' }],
    }),
    prisma.setting.findUnique({ where: { key: WEDDING_DETAILS_KEY } }),
  ])
  let details = DEFAULT_DETAILS
  if (detailsRow?.value) {
    try { details = { ...DEFAULT_DETAILS, ...JSON.parse(detailsRow.value) } } catch {}
  }
  return NextResponse.json({ guests, details })
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json()
  const details = {
    date: String(body.date ?? 'TBA'),
    time: String(body.time ?? 'TBA'),
    venueName: String(body.venueName ?? 'TBA'),
    venueAddress: String(body.venueAddress ?? ''),
  }
  await prisma.setting.upsert({
    where: { key: WEDDING_DETAILS_KEY },
    create: {
      key: WEDDING_DETAILS_KEY, value: JSON.stringify(details),
      valueType: 'json', description: 'Date/time/venue revealed only via gated email',
    },
    update: { value: JSON.stringify(details) },
  })
  return NextResponse.json({ ok: true, details })
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v ".next/types" | head`
Expected: no errors in `app/api/admin/rsvps/route.ts` (pre-existing `.next/types` errors are fixed in Task 12).

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/rsvps/route.ts
git commit -m "feat(admin): RSVP bucket data + wedding-details setting API"
```

---

### Task 10: Gated send API

**Files:**
- Create: `app/api/admin/rsvps/send/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/admin/rsvps/send/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail, logEmail, COORDINATOR_FROM, NOTIFY_EMAIL } from '@/lib/email'
import {
  generateVenueDetailsEmail,
  generateGraciousRegretsEmail,
  WeddingDetails,
} from '@/lib/email-templates'

const sendSchema = z.object({
  guestIds: z.array(z.string().uuid()).min(1).max(100),
  template: z.enum(['venue_details', 'gracious_regrets']),
  dryRun: z.boolean().optional(),
})

async function loadDetails(): Promise<WeddingDetails> {
  const row = await prisma.setting.findUnique({ where: { key: 'wedding_details' } })
  const fallback: WeddingDetails = { date: 'TBA', time: 'TBA', venueName: 'TBA', venueAddress: '' }
  if (!row?.value) return fallback
  try { return { ...fallback, ...JSON.parse(row.value) } } catch { return fallback }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const parsed = sendSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const { guestIds, template, dryRun } = parsed.data

  const guests = await prisma.guest.findMany({ where: { id: { in: guestIds } } })
  const details = await loadDetails()

  const render = (firstName: string) =>
    template === 'venue_details'
      ? generateVenueDetailsEmail(firstName, details)
      : generateGraciousRegretsEmail(firstName)

  if (dryRun) {
    const sample = guests[0]
    return NextResponse.json({ preview: render(sample?.firstName ?? ''), recipients: guests.length })
  }

  const results = []
  for (const guest of guests) {
    const tpl = render(guest.firstName)
    const res = await sendEmail(
      { ...tpl, to: guest.email },
      { from: COORDINATOR_FROM, replyTo: NOTIFY_EMAIL }
    )
    await logEmail({
      guestId: guest.id,
      emailType: `gated_${template}`,
      recipientEmail: guest.email,
      subject: tpl.subject,
      status: res.success ? 'sent' : 'failed',
      resendMessageId: res.success ? res.messageId : null,
    })
    results.push({ guestId: guest.id, email: guest.email, success: res.success, error: res.success ? undefined : res.error })
  }
  return NextResponse.json({ results })
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep "app/api/admin/rsvps" | head`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/rsvps/send/route.ts
git commit -m "feat(admin): gated email send API — coordinator From, per-recipient results"
```

---

### Task 11: Admin RSVPs page (Nicolle's panel)

**Files:**
- Create: `app/admin/rsvps/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/admin/rsvps/page.tsx` (client component; follows existing admin page style — see `app/admin/guests/page.tsx` for reference). Full component:

```tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

interface EmailLogEntry {
  emailType: string
  status: string | null
  sentAt: string
  openedAt: string | null
  bouncedAt: string | null
}

interface GuestRow {
  id: string
  firstName: string
  lastName: string
  email: string
  attending: boolean | null
  partySize: number | null
  dietaryRestrictions: string | null
  songRequest: string | null
  source: string
  rsvpReceivedAt: string | null
  emailLogs: EmailLogEntry[]
}

interface Details { date: string; time: string; venueName: string; venueAddress: string }

const BUCKETS = [
  { key: 'matched-yes', label: 'Matched — Attending', filter: (g: GuestRow) => g.source === 'imported' && g.attending === true },
  { key: 'unmatched-yes', label: 'Unmatched — Attending (review!)', filter: (g: GuestRow) => g.source === 'self_rsvp' && g.attending === true },
  { key: 'matched-no', label: 'Matched — Declined', filter: (g: GuestRow) => g.source === 'imported' && g.attending === false },
  { key: 'unmatched-no', label: 'Unmatched — Declined', filter: (g: GuestRow) => g.source === 'self_rsvp' && g.attending === false },
] as const

export default function AdminRsvpsPage() {
  const [guests, setGuests] = useState<GuestRow[]>([])
  const [details, setDetails] = useState<Details>({ date: '', time: '', venueName: '', venueAddress: '' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [template, setTemplate] = useState<'venue_details' | 'gracious_regrets'>('venue_details')
  const [preview, setPreview] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/rsvps')
    if (res.ok) {
      const data = await res.json()
      setGuests(data.guests)
      setDetails(data.details)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const responded = useMemo(() => guests.filter((g) => g.rsvpReceivedAt), [guests])
  const awaiting = useMemo(() => guests.filter((g) => !g.rsvpReceivedAt && g.source === 'imported'), [guests])
  const headcount = useMemo(
    () => responded.filter((g) => g.attending).reduce((sum, g) => sum + (g.partySize ?? 1), 0),
    [responded]
  )

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const saveDetails = async () => {
    const res = await fetch('/api/admin/rsvps', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(details),
    })
    setStatusMsg(res.ok ? 'Wedding details saved.' : 'Failed to save details.')
  }

  const doPreview = async () => {
    const res = await fetch('/api/admin/rsvps/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestIds: [...selected], template, dryRun: true }),
    })
    if (res.ok) {
      const data = await res.json()
      setPreview(data.preview.html)
    }
  }

  const doSend = async () => {
    if (!selected.size) return
    if (!window.confirm(`Send "${template.replace('_', ' ')}" to ${selected.size} guest(s)?`)) return
    setSending(true)
    setStatusMsg('')
    try {
      const res = await fetch('/api/admin/rsvps/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestIds: [...selected], template }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatusMsg(data.error || 'Send failed.')
        return
      }
      const ok = data.results.filter((r: { success: boolean }) => r.success).length
      const failed = data.results.length - ok
      setStatusMsg(`Sent ${ok} email(s)${failed ? `, ${failed} FAILED — check the log column` : ''}.`)
      setSelected(new Set())
      setPreview(null)
      await load()
    } finally {
      setSending(false)
    }
  }

  const lastSend = (g: GuestRow) => {
    const log = g.emailLogs[0]
    if (!log) return '—'
    const flags = [
      log.status === 'failed' ? '❌ failed' : '✉️ sent',
      log.openedAt ? '👁 opened' : null,
      log.bouncedAt ? '⚠️ bounced' : null,
    ].filter(Boolean).join(' · ')
    return `${log.emailType.replace('gated_', '')} — ${flags}`
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-serif text-[#00330a] mb-1">RSVPs &amp; Communications</h1>
      <p className="text-gray-600 mb-6">
        {responded.length} responses · expected headcount {headcount} · {awaiting.length} invited, not yet responded
      </p>

      <section className="mb-8 rounded border border-[#D4AF37]/50 bg-white p-4">
        <h2 className="font-medium text-[#00330a] mb-3">Wedding details (only ever revealed via the gated email)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {(['date', 'time', 'venueName', 'venueAddress'] as const).map((field) => (
            <input key={field} value={details[field]} placeholder={field}
              onChange={(e) => setDetails({ ...details, [field]: e.target.value })}
              className="rounded border-gray-300 text-sm" />
          ))}
        </div>
        <button onClick={saveDetails} className="mt-3 rounded bg-[#00330a] px-4 py-2 text-white text-sm">
          Save details
        </button>
      </section>

      <section className="mb-6 flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-white p-4">
        <span className="text-sm text-gray-700">{selected.size} selected</span>
        <select value={template} onChange={(e) => setTemplate(e.target.value as typeof template)}
          className="rounded border-gray-300 text-sm">
          <option value="venue_details">Venue details (date/time/venue)</option>
          <option value="gracious_regrets">Gracious regrets</option>
        </select>
        <button onClick={doPreview} disabled={!selected.size}
          className="rounded border border-[#00330a] px-4 py-2 text-sm text-[#00330a] disabled:opacity-50">
          Preview
        </button>
        <button onClick={doSend} disabled={!selected.size || sending}
          className="rounded bg-[#00330a] px-4 py-2 text-sm text-white disabled:opacity-50">
          {sending ? 'Sending…' : 'Send to selected'}
        </button>
        <button
          onClick={() => {
            const songs = responded
              .filter((g) => g.attending && g.songRequest)
              .map((g) => `${g.songRequest} — requested by ${g.firstName} ${g.lastName}`)
              .join('\n')
            navigator.clipboard.writeText(songs)
            setStatusMsg(songs ? 'Song list copied to clipboard.' : 'No song requests yet.')
          }}
          className="rounded border border-[#D4AF37] px-4 py-2 text-sm text-[#00330a]">
          Copy song list 🎵
        </button>
        {statusMsg && <span className="text-sm text-gray-700">{statusMsg}</span>}
      </section>

      {BUCKETS.map((bucket) => {
        const rows = responded.filter(bucket.filter)
        return (
          <section key={bucket.key} className="mb-8">
            <h2 className="font-medium text-[#00330a] mb-2">{bucket.label} ({rows.length})</h2>
            {rows.length === 0 ? (
              <p className="text-sm text-gray-500">None yet.</p>
            ) : (
              <div className="overflow-x-auto rounded border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-600">
                    <tr>
                      <th className="p-2 w-8"></th>
                      <th className="p-2">Name</th>
                      <th className="p-2">Email</th>
                      <th className="p-2">Party</th>
                      <th className="p-2">Dietary</th>
                      <th className="p-2">Song</th>
                      <th className="p-2">RSVP&apos;d</th>
                      <th className="p-2">Last email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((g) => (
                      <tr key={g.id} className="border-t border-gray-100">
                        <td className="p-2">
                          <input type="checkbox" checked={selected.has(g.id)} onChange={() => toggle(g.id)} />
                        </td>
                        <td className="p-2">{g.firstName} {g.lastName}</td>
                        <td className="p-2">{g.email}</td>
                        <td className="p-2">{g.partySize ?? '—'}</td>
                        <td className="p-2">{g.dietaryRestrictions || '—'}</td>
                        <td className="p-2">{g.songRequest || '—'}</td>
                        <td className="p-2">{g.rsvpReceivedAt ? new Date(g.rsvpReceivedAt).toLocaleDateString() : '—'}</td>
                        <td className="p-2">{lastSend(g)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPreview(null)}>
          <div className="max-h-[80vh] max-w-2xl w-full overflow-auto rounded bg-white p-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex justify-between">
              <strong>Preview (first selected guest)</strong>
              <button onClick={() => setPreview(null)} className="text-gray-500">✕ close</button>
            </div>
            <iframe srcDoc={preview} className="h-[60vh] w-full border" title="Email preview" />
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev`, log in as admin, open `http://localhost:3000/admin/rsvps`:
1. Buckets show the RSVPs created in Task 8's smoke test.
2. Fill in wedding details, Save, reload — values persist.
3. Select a guest (use your own test RSVP), Preview → the venue-details email renders with the saved details.
4. Send to your own email → arrives from "Wedding Coordinator", reply-to is Nicolle's Proton; "Last email" column updates after reload.

- [ ] **Step 3: Commit**

```bash
git add app/admin/rsvps/page.tsx
git commit -m "feat(admin): RSVPs panel — four buckets, details editor, gated send with preview"
```

---

### Task 12: Resend webhooks (opens/bounces) + Next 15 params fixes + docs

**Files:**
- Create: `app/api/webhooks/resend/route.ts`
- Modify: `app/api/admin/guests/[id]/route.ts`
- Modify: `app/api/admin/users/[id]/route.ts`
- Modify: `app/api/admin/wedding-party/[id]/route.ts`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Install svix**

Run: `npm install svix`

- [ ] **Step 2: Create the webhook route**

Create `app/api/webhooks/resend/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { prisma } from '@/lib/prisma'

// Resend signs webhooks with svix. Configure the endpoint + secret at
// https://resend.com/webhooks and set RESEND_WEBHOOK_SECRET in Railway.
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }
  const payload = await request.text()
  const headers = {
    'svix-id': request.headers.get('svix-id') ?? '',
    'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
    'svix-signature': request.headers.get('svix-signature') ?? '',
  }
  let event: { type: string; data: { email_id?: string } }
  try {
    event = new Webhook(secret).verify(payload, headers) as typeof event
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const messageId = event.data?.email_id
  if (messageId) {
    if (event.type === 'email.opened') {
      await prisma.emailLog.updateMany({
        where: { resendMessageId: messageId, openedAt: null },
        data: { openedAt: new Date() },
      })
    } else if (event.type === 'email.bounced') {
      await prisma.emailLog.updateMany({
        where: { resendMessageId: messageId },
        data: { bouncedAt: new Date(), status: 'bounced' },
      })
    } else if (event.type === 'email.delivered') {
      await prisma.emailLog.updateMany({
        where: { resendMessageId: messageId, status: 'sent' },
        data: { status: 'delivered' },
      })
    }
  }
  return NextResponse.json({ received: true })
}
```

- [ ] **Step 3: Fix Next 15 params in the three admin [id] routes**

In each of `app/api/admin/guests/[id]/route.ts`, `app/api/admin/users/[id]/route.ts`, `app/api/admin/wedding-party/[id]/route.ts`, both the `PUT` and `DELETE` handlers use the Next 14 signature. Change each handler from:

```ts
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  // ... uses params.id
```

to:

```ts
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // ... replace every `params.id` in the handler body with `id`
```

Apply the identical change to `DELETE` in all three files (6 handlers total).

- [ ] **Step 4: Verify typecheck is fully clean**

Run: `rm -rf .next && npx tsc --noEmit`
Expected: zero errors (this was failing before — these three files were the blockers).

- [ ] **Step 5: Update CLAUDE.md tech stack**

In `CLAUDE.md`, change `- **Framework:** Next.js 14 with App Router` to `- **Framework:** Next.js 15 with App Router`.

- [ ] **Step 6: Commit**

```bash
git add app/api/webhooks/resend/route.ts app/api/admin/guests/ app/api/admin/users/ app/api/admin/wedding-party/ CLAUDE.md package.json package-lock.json
git commit -m "feat: Resend webhook for opens/bounces; fix Next 15 params; docs"
```

---

### Task 13: Full verification

- [ ] **Step 1: Full test suite**

Run: `npx jest`
Expected: all suites pass (new: blocklist, email-send, email-templates, rsvp; existing suites unaffected).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build completes with no type errors.

- [ ] **Step 3: End-to-end smoke (dev server)**

With `npm run dev`:
1. Submit an attending RSVP at `/rsvp` → modal + notification email to Nicolle.
2. Submit `Tom Walters` → modal identical; verify no guest row; blocked-attempt email arrives.
3. `/admin/rsvps` → select the test guest → send venue details to your own address → arrives from Wedding Coordinator with reply-to Nicolle.
4. Confirm `email_logs` rows exist with real statuses: `node -e "require('dotenv').config({path:'.env.local'});const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.emailLog.findMany({orderBy:{sentAt:'desc'},take:5}).then(r=>{console.table(r.map(l=>({type:l.emailType,to:l.recipientEmail,status:l.status})));return p.\$disconnect()})"`

- [ ] **Step 4: Deliverability check**

Get a disposable address from https://www.mail-tester.com, send the venue-details template to it via the admin panel, check the score. Expected: ≥ 9/10 (SPF, DKIM, DMARC all pass; text part present).

- [ ] **Step 5: Commit any fixes, then push**

```bash
git push -u origin fix/critical-rsvp-session
```

---

### Post-merge operational steps (Whitney/Nicolle — not code)

1. Resend dashboard → Webhooks → Add endpoint `https://walters-pierce-wedding.com/api/webhooks/resend`, events: delivered/opened/bounced/complained → copy signing secret → Railway variable `RESEND_WEBHOOK_SECRET`.
2. Resend dashboard → Domains → walters-pierce-wedding.com → enable open tracking.
3. Nicolle: add `noreply@walters-pierce-wedding.com` and `coordinator@walters-pierce-wedding.com` to Proton contacts.
4. Confirm whose address `mdharris5546@gmail.com` is (it's on the imported list).
5. Fill in real wedding details in `/admin/rsvps` before the first venue-details send.
