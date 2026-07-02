# RSVP Redesign — Shared QR Code, Accept-All-and-Flag, Gated Communications

**Date:** 2026-07-01
**Status:** Draft for approval
**Stakeholders:** Whitney (dev/infra), Emme (bride), Nicolle (Mother of the Bride — owns all guest communication)
**Scale:** ~50 guests

## Why

Per-guest invitation codes were dropped: printing unique codes on invitations was too expensive. Invitations now carry a single shared QR code pointing to `/rsvp`. The old code-lookup flow is obsolete. Guest-facing email is now a controlled channel: nothing goes to a guest inbox unless Nicolle (or Emme) explicitly sends it from the admin panel.

## Guest-facing flow

1. Guest scans QR → lands on `/rsvp` (existing page, rebuilt as a single-step form).
2. Form fields:
   - First name, last name (required)
   - Email (required, validated)
   - Attending: yes / no (required)
   - Number of guests in party, including themselves (required if attending; integer 1–10)
   - Dietary restrictions (optional, free text, covers the whole party)
   - Favorite song — reception song request (optional, free text)
3. On submit, a modal (not a redirect) confirms:
   - **Attending yes:** "Thank you — we look forward to celebrating with you! Watch your inbox for further information (date, time, and venue)."
   - **Attending no:** "Thank you — we would love to have you with us, but we understand. You'll be missed!"
4. **No email is sent to the guest at submit time.** The modal is the receipt. All guest-facing email is gated (see Communications).
5. Re-submission with the same email updates the existing response (last write wins; `rsvpReceivedAt` re-stamped).

### Server-side handling

- Match by email (case-insensitive, trimmed) against the `guests` table.
  - **Match found** → update that row: `attending`, `partySize`, `dietaryRestrictions`, `songRequest`, `rsvpReceivedAt`. Name on file is kept; submitted name stored if the row's name fields are empty.
  - **No match** → create a new `Guest` row with `source = 'self_rsvp'`.
- All rows existing before this feature (imports + save-the-date signups) count as **matched** (`source = 'imported'`, backfilled by migration).
- The server never trusts client-supplied IDs; identity is the submitted email.

### Blocklist (sensitive)

- Stored in the `Setting` table, key `rsvp_blocklist`: JSON array of normalized full names. Seeded with: `marci harris`, `marciann harris`, `montana harris`, `tom walters`, `thomas walters`.
- Normalization: lowercase, collapse whitespace, strip non-letters. Checked against submitted first+last name **before** any database write.
- On a blocklist hit: show the normal thank-you modal, write **nothing** to `guests`, send **no** confirmation, and send Nicolle a discreet "blocked RSVP attempt" notification email with the submitted details and timestamp.
- Blocked attempts are recorded in `AuditLog` (action `rsvp_blocked`) so there's a trail even if the email is missed.

## Data model changes (Prisma migration)

Add to `Guest`:
- `partySize Int?` — party count including the guest
- `songRequest String?` — reception song request
- `source String @default("imported")` — `'imported'` | `'self_rsvp'`

Existing `PlusOne` table: untouched (legacy data preserved) but no longer written by the RSVP flow. `invitationCode` stays nullable and unused.

## Emails

### Layer: lib/email.ts rewritten on Resend

- `sendEmail()` keeps its signature, internally uses the Resend SDK (`RESEND_API_KEY`, `FROM_EMAIL` — both already live in local + Railway; domain verified 2026-07-01).
- Every send writes an honest `EmailLog` row (`sent` / `failed` from the actual API response). The MailerLite stub and its fictional `sent` logs are removed.
- All templates include both HTML and plain-text parts (deliverability).

### Automatic emails (to Nicolle only — lnawalters@protonmail.com)

- **New RSVP notification** — sent on every submission: name, email, matched/unmatched, attending, party size, dietary, song request, timestamp. Subject prefix distinguishes buckets, e.g. "RSVP ✓ (matched): Jane Smith — party of 2".
- **Blocked attempt notification** — as above, discreet subject.
- From: `Emme & Connor's Wedding <noreply@walters-pierce-wedding.com>`.

### Gated emails (to guests — only via admin panel)

- From: `Wedding Coordinator <coordinator@walters-pierce-wedding.com>`, Reply-To: `lnawalters@protonmail.com` — presents as a wedding coordinator; replies still reach Nicolle's Proton inbox. (Sending literally from protonmail.com is impossible without spoofing — DMARC would spam-folder it.)
- Templates (v1, defined in code, forest-green/gold theme):
  1. **Venue details** — date, time, venue, directions. Intended audience: approved (typically matched) yeses.
  2. **Gracious regrets** — warm "the guest list is limited" message. Intended audience: unmatched yeses Nicolle does not approve.
- No template is auto-sent to any audience. Nicolle picks recipients individually (checkboxes) regardless of bucket, previews, confirms. RSVP-nos get nothing (deliberate; can change later).

## Admin panel (Nicolle's view)

New page `admin/rsvps` (NextAuth-protected like existing admin):
- **Four buckets** with counts: matched-yes, unmatched-yes, matched-no, unmatched-no. Each lists name, email, party size, dietary, song request, RSVP timestamp.
- **Send flow:** select guests (within or across buckets) → choose template → preview rendered email → confirm send. Progress + per-recipient result shown.
- **Per-guest email history** from `EmailLog`: what was sent, when, status, opened-at, bounced.
- Totals strip: expected headcount (sum of `partySize` for yeses), song request list export.

## Open & bounce tracking

- Enable open/click tracking for the domain in the Resend dashboard (manual step).
- New endpoint `POST /api/webhooks/resend` receives Resend webhook events (svix signature verified via `RESEND_WEBHOOK_SECRET` env var): `email.delivered`, `email.opened`, `email.bounced`, `email.complained`.
- Events update `EmailLog` (add `openedAt`, `bouncedAt` columns) — surfaced in the admin panel.
- Caveat accepted: opens are directional (Apple Mail inflates, Proton blocks pixels); bounces are authoritative.

## Removals & fixes bundled in

- **Delete** `/api/rsvp/lookup` (code-based lookup obsolete).
- **Delete** the `rsvp-session` cookie logic and `/api/wedding-details/access-check`; the wedding-details page is retired or reduced to generic content with no gated data (date/time/venue live only in the gated email — decided 2026-07-01). This removes the unsigned-cookie vulnerability and the sync-`cookies()` bug without replacement code.
- **Fix** Next 15 `params: Promise<{id}>` signatures in `admin/guests/[id]`, `admin/users/[id]`, `admin/wedding-party/[id]` routes (current build blocker).
- Update CLAUDE.md tech-stack note (Next 15, not 14).

## Testing

- Unit: blocklist normalization/matching (including spacing/case variants), email match-or-create logic, party size validation.
- Route tests: `/api/rsvp/submit` (matched update, unmatched create, blocklist short-circuit, invalid payloads), webhook signature rejection.
- Template render tests: both templates produce HTML + text with expected fields.
- Manual: end-to-end smoke with a real send to mail-tester.com before invitations go out.

## Out of scope (deliberate)

- Editing email template content from the admin UI (v2 if needed).
- Emails to RSVP-nos.
- Named per-party-member entry / seating charts.
- Save-the-date campaign tooling (existing separate flow untouched).

## Operational prerequisites (Whitney/Nicolle)

1. Import the full ~50-guest list via existing admin CSV import before invitations mail.
2. Enable open tracking in Resend dashboard; create webhook endpoint pointing at production `/api/webhooks/resend`; put its signing secret in Railway as `RESEND_WEBHOOK_SECRET`.
3. Nicolle: add `noreply@walters-pierce-wedding.com` to Proton contacts.
