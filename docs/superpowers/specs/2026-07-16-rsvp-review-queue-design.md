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
4. One-click **confirm** and **decline** emails, reusing existing templates + send infra.
5. Retire the orphaned `/admin/rsvps` bucket panel (superseded by this), preserving its
   still-needed wedding-details editor.

## Non-Goals

- Reminders / broader "Admin Email Suite" scheduling (separate future work).
- New email template copy — reuse `venue_details` (confirm) and `gracious_regrets`
  (decline); wording can be edited later.
- PlusOne-row creation (headcount continues to live in `rsvpdCount`).

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

### Send confirm / Send decline
Reuse existing `POST /api/admin/rsvps/send`:
- **Send "You're coming" info** → `template: 'venue_details'` (includes the `.ics`).
- **Send regrets** → `template: 'gracious_regrets'`.
- Each action shows a confirm dialog (+ optional preview via the existing `dryRun`
  path) before sending, and writes the existing `EmailLog` (`gated_venue_details` /
  `gated_gracious_regrets`) so the row can show last-email status.
- Sending is independent of approve/delete (Nicolle may send the confirm after
  approving, or send regrets then delete). No auto-send is wired to approve/delete in v1.

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
  Match, Delete, Send-confirm, Send-regrets.
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
