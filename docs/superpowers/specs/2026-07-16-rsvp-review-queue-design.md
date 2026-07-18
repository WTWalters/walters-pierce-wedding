# Unmatched – To Review Queue — Design Spec

**Date:** 2026-07-16
**Requested by:** Nicolle (Mother of the Bride), via email 2026-07-16
**Status:** Approved (design), pending implementation plan

## Problem

RSVP submissions that don't match anyone on the official invite list are currently
created as `Guest` rows with `source='self_rsvp'` and **mixed straight into the main
Guest Management list and the ATTENDING headcount**. There is no persisted "reviewed"
state, so an unmatched gate-crasher inflates the catering count before anyone vets them.

Nicolle wants unmatched submissions held in a separate review queue, invisible
everywhere else until she approves them, with per-row actions to approve, match to an
existing invited guest, delete, and send one of two canned emails.

## Goals

1. A new **"To Review"** admin tab listing only unreviewed unmatched submissions.
2. Unmatched submissions **excluded from Guest Management and all counts** until approved.
3. Per-row actions: **View, Approve, Match-to-guest, Delete.**
4. A **"Message to Send" dropdown** (RSVP Yes / RSVP No / Incorrect RSVP) on both the
   Guest Management and To Review grids — see the 2026-07-17 Update below.
5. Retire the orphaned `/admin/rsvps` bucket panel (superseded by this), preserving its
   still-needed wedding-details editor.

## Non-Goals

- Reminders / broader "Admin Email Suite" scheduling (separate future work).
- PlusOne-row creation (headcount continues to live in `rsvpdCount`).

## Update (2026-07-17, Nicolle's second email)

Two additions to the approved design:

1. **A "Message to Send" dropdown on BOTH the Guest Management grid and the To Review
   grid** — per row, pick a message and it sends to the email on file.
2. **Three branded messages with Nicolle's own copy**, styled like the honeymoon-fund
   thank-you email (`generateRegistryThankYouEmail`). These REPLACE the earlier
   "reuse `venue_details`/`gracious_regrets`" decision:
   - **RSVP Yes** (confirmation, includes the venue block)
   - **RSVP No** (acknowledges a decline — "sorry to miss you")
   - **Incorrect RSVP** (over-count — personalized with name + their count vs. invited seats)

   Full copy in the Appendix. The venue name/address lives in the editable
   `wedding_details` Setting (pre-filled with Blackstone Rivers Ranch), rendered ONLY in
   the gated RSVP-Yes email — never on the public site (family privacy invariant).

## Data Model

Add one nullable field to `Guest` (chosen over flipping `source`, which loses
provenance, and over a status enum, which is more than needed):

```prisma
model Guest {
  // ... existing fields ...
  reviewedAt  DateTime? @map("reviewed_at")
  reviewedBy  String?   @map("reviewed_by")   // admin email who approved/matched
}
```

Derived states (no other schema change):
- **In the review queue:** `source = 'self_rsvp' AND reviewedAt IS NULL`
- **Counted / listed in Guest Management:** `source = 'imported' OR reviewedAt IS NOT NULL`

Migration: `ADD COLUMN reviewed_at TIMESTAMP NULL`, `ADD COLUMN reviewed_by TEXT NULL`.
Additive and safe against existing prod rows (all existing rows get NULL → existing
`self_rsvp` rows correctly appear in the new queue on first load).

## Actions & Semantics

### Approve
`POST /api/admin/review/[id]/approve`
- Sets `reviewedAt = now()`, `reviewedBy = session.user.email`.
- Sets `reservedSeats = rsvpdCount` if `reservedSeats` is null, so the approved party's
  seats are reflected in Total Invited (self_rsvp rows have null reservedSeats today).
- Effect: row leaves the queue, appears in Guest Management, and joins the counts.

### Match to existing guest
`POST /api/admin/review/[id]/match` — body `{ targetGuestId }`
- Copies the submission's RSVP data onto the target invited guest:
  `attending`, `rsvpdCount`, `dietaryRestrictions`, `songRequest`, `rsvpReceivedAt`.
- Does **not** overwrite the target's `email`, `firstName`, `lastName`, or `reservedSeats`
  (the official record stays authoritative — matches the existing "name-match never
  overwrites email" security invariant).
- Deletes the submission row (`prisma.guest.delete`, cascades its plusOnes/emailLogs).
- If `submission.rsvpdCount > target.reservedSeats`, the API returns an over-cap
  warning field; the UI shows it and lets the admin confirm-proceed (does not hard-block).
- Target must be `source='imported'`; guard against matching to another self_rsvp row.

### Delete
Reuse existing `DELETE /api/admin/guests/[id]` (removes the submission entirely — used
for gate-crashers like the blocklisted Thomas; no email is sent).

### View
Detail modal, reusing the Guest Management view modal component/shape.

### Send a message ("Message to Send" dropdown)
A shared per-row dropdown on BOTH grids (Guest Management + To Review) with three options,
each sending to the guest's email on file via the extended `POST /api/admin/rsvps/send`:
- **RSVP Yes** → `template: 'rsvp_yes'` (branded confirmation + venue from the Setting; `.ics` attached)
- **RSVP No** → `template: 'rsvp_no'` (branded "sorry to miss you")
- **Incorrect RSVP** → `template: 'rsvp_over_count'` (branded, personalized with `rsvpdCount` vs `reservedSeats`)

- Each send shows a confirm dialog before firing and writes the existing `EmailLog`
  (`gated_rsvp_yes` / `gated_rsvp_no` / `gated_rsvp_over_count`) so the row shows last-email status.
- Sending is independent of approve/delete/match.
- All three templates are styled after `generateRegistryThankYouEmail` (the honeymoon-fund
  thank-you look).
- `rsvp_over_count` needs the guest's `reservedSeats`; matched guests have it. If an
  unmatched submission (null `reservedSeats`) is sent this, the number falls back to the
  invited-count phrasing without a raw "null" (edge case — primarily a Guest Management action).

## API Surface

New:
- `GET  /api/admin/review` — returns unreviewed self_rsvp rows (+ plusOnes), same shape
  the grid needs; also returns the count for the nav badge.
- `POST /api/admin/review/[id]/approve`
- `POST /api/admin/review/[id]/match`  (body `{ targetGuestId }`)

Modified:
- `GET /api/admin/guests` — exclude unreviewed self_rsvp (`NOT (source='self_rsvp' AND reviewedAt=null)`).
- `GET /api/admin/guests/stats` and `GET /api/admin/stats` — same exclusion applied to
  `attending`, `notAttending`, `rsvpReceived` so unmatched are not counted until approved.

Reused unchanged: `POST /api/admin/rsvps/send`, the `wedding_details` Setting GET/PUT.

All new/modified routes keep the standard guard:
`if (!session || session.user.role !== 'admin') → 401`.

## UI

- **Nav:** add `{ href: '/admin/review', label: 'To Review' }` to `NAV_LINKS` in
  `app/admin/layout.tsx`, with a count badge (e.g. "To Review · 3") sourced from
  `GET /api/admin/review`. Badge hidden when zero.
- **Page `app/admin/review/page.tsx`:** Guest-Management-style grid, **no summary
  boxes**. Columns: Name (`formatPartyName`), Attending (yes/no badge), Party count
  (`rsvpdCount`), Dietary, Song, Submitted date, Last email. Row actions: View, Approve,
  Match, Delete, and the shared "Message to Send" dropdown (Yes / No / Incorrect).
- **Guest Management grid:** gains the same "Message to Send" dropdown per row (Nicolle's
  second email) — sends to the email on file.
- **Match modal:** searchable list of `source='imported'` guests to pick the target;
  shows the over-cap warning inline when relevant.
- **Wedding-details editor:** moved from the retired `/admin/rsvps` page onto this page
  as a collapsible "Wedding details" section (date/time/venue), since `venue_details`
  sends depend on it. Reuses the existing `wedding_details` Setting GET/PUT.
- **Empty state:** "No submissions to review." 

## Retiring the old panel

- Remove `app/admin/rsvps/page.tsx` (bucket UI superseded).
- Keep `app/api/admin/rsvps/send/route.ts` (reused) and `app/api/admin/rsvps/route.ts`
  (wedding_details GET/PUT, reused by the moved editor).
- No nav entry pointed at `/admin/rsvps`; also remove any dashboard card/link to it
  (`app/admin/page.tsx`) if present, repointing to `/admin/review`.

## Testing

- **rsvp review filter** (unit): given mixed rows, the review list returns only
  unreviewed self_rsvp; approve/match flip membership correctly.
- **stats exclusion** (unit): ATTENDING / rsvpReceived exclude unreviewed self_rsvp and
  include them once `reviewedAt` is set.
- **approve route** (unit): sets reviewedAt/reviewedBy, backfills reservedSeats, 401s
  non-admin.
- **match route** (unit): copies RSVP fields onto target, deletes submission, does not
  overwrite target identity/email, returns over-cap warning, rejects non-imported target,
  401s non-admin.
- **guests list exclusion** (unit): main list omits unreviewed self_rsvp.
- Page verified via live smoke (repo convention: API-level unit tests + browser smoke).

## Rollout notes

- Migration is additive; Railway `prisma migrate deploy` applies it on push.
- No Cloudinary/Stripe/env prerequisites.
- On first deploy, any existing prod `self_rsvp` rows surface in the queue (correct).

## Appendix — Message copy (Nicolle, 2026-07-17)

Rendered in the honeymoon-fund thank-you style (`generateRegistryThankYouEmail`). `{firstName}`,
`{rsvpdCount}`, `{reservedSeats}` are interpolated; the venue block comes from the
`wedding_details` Setting.

**RSVP Yes** (`rsvp_yes`) — subject e.g. "You're locked in — Emme & Connor":
> It's official—you're locked in! We received your RSVP and couldn't be happier. We're
> counting down the days until we get to celebrate together!
>
> Our venue is **{venueName}**.
> The address is:
> {venueAddress}

(venueName/venueAddress from the Setting — pre-filled: Blackstone Rivers Ranch,
3673 Chicago Creek Rd, Idaho Springs, CO 80452. `.ics` attached, as with the prior venue email.)

**RSVP No** (`rsvp_no`):
> Thank you for updating your RSVP! We are so sorry to miss you on our special day, but we
> truly appreciate you letting us know.

**Incorrect RSVP / too many** (`rsvp_over_count`):
> Hi {firstName}! We are so looking forward to having you at our wedding. We noticed your
> RSVP included {rsvpdCount} guests, but due to our intimate guest count and venue space,
> we are only able to host the {reservedSeats} spots listed on your invitation. Let us know
> if you can still celebrate with us within that count—we'd love to have you!

## Rollout addendum

- Seed the `wedding_details` Setting on deploy with the real venue (Blackstone Rivers Ranch
  + address) so the RSVP-Yes email renders it. Venue stays gated: it appears ONLY in these
  emails, never in any public page/route/metadata (verified invariant from the earlier
  privacy sweep).
