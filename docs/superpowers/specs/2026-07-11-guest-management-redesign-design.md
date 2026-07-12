# Guest Management Redesign — Nicolle's Admin Consolidation

**Date:** 2026-07-11
**Status:** Approved — implementation starting
**Stakeholders:** Whitney (dev), Nicolle Walters (acting Wedding Coordinator — primary and sole admin user), Emme & Connor
**Supersedes/extends:** `2026-07-03-admin-email-suite-design.md` — the proxy-RSVP and reminder features from that spec now live on the **Guest Management** page (`/admin/guests`), not `/admin/rsvps`, per Nicolle's markups.
**Source of requirements:** Two annotated screenshots from Nicolle (2026-07-09) — the Dashboard grid and the Guest Management page — plus a follow-up email clarifying the stat-box math.

## Why

Nicolle is the only person who uses the admin portal, and she's told us the current layout gets in her way. Her asks reduce to two themes:

1. **One hub, not nine.** The dashboard's 9 quick-action tiles are mostly dead ends or redundant. She wants the guest list to be the one place she manages everyone — list, RSVP recording, and (later) sending email — and the rest gone.
2. **The guest list must model real parties.** Today a "guest" is one person with one fuzzy `partySize`. Real invitations go to couples and families: two people who might each reply, a fixed number of reserved seats that an RSVP can't exceed, and a requested song. The current data model can't represent this, so she's been stuffing "Andre & Heather" into a single first-name field — which makes name-matching a nightmare.

## Scope of this round

**In:** Dashboard tile consolidation; Guest Management stat boxes; the guest data model (partner name, reserved seats, RSVP'd count); the edit modal (resize + new fields); the list columns; combined-couple display; the reserved-seats cap invariant; partner-name matching.

**Deferred (separate plans, explicitly out of this round):**
- **Email consolidation onto Guest Management** — relocating the `/admin/rsvps` gated send flow + reminders (the Feature 2 work from the email-suite spec) into this page. Tracked; not built here.
- **Photo Gallery** page (model exists, no UI).
- **Registry & Gifts / Venmo link** page (model exists, no UI).

## Dashboard changes (`app/admin/page.tsx`)

Reduce the quick-action grid from 9 visible tiles to Nicolle's **three**: **Guest Management**, **Photo Gallery**, **Registry & Gifts**.

Remove entirely:
- **RSVPs & Communications** → folds into Guest Management (RSVP work moves onto the guest list).
- **Email Management** → redundant with Guest Management (send flow will relocate there in the deferred email plan).
- **Save-the-Date Campaign** → campaign is over; not used as intended.
- **Venue & Events** → linked to a page that never existed.
- **To-Do List** → was fake (client-only, no persistence).
- **Wedding Party** → removed from the dashboard grid. (The admin CRUD route still exists; the public wedding-party page is hardcoded and never read from it anyway. Removing the tile changes nothing user-visible on the public site.)

**Open item flagged for Nicolle (not blocking):** the grid also contains **Admin Users** and **Settings** tiles, which weren't in her screenshot. Admin Users is how a hired coordinator would later be given a login. Recommendation: keep **Admin Users** reachable (a small secondary link below the three primary tiles) rather than deleting it outright; drop the **Settings** tile (it links to an unbuilt page). Confirm with Nicolle.

Photo Gallery and Registry & Gifts tiles are **kept but still link to unbuilt pages** this round (their build is deferred). They read as "coming soon" placeholders until those plans land.

## Guest Management changes (`app/admin/guests/page.tsx`)

### Stat boxes: 6 → 4

| Box | Value | Notes |
|---|---|---|
| **Total Guests Invited** | Σ `reservedSeats` across all parties | People headcount. Nicolle populates `reservedSeats` manually; expected total ≈ 117. |
| **RSVP Received** | `attending + notAttending` | Derived count of parties that responded either way. |
| **Attending** | count of parties with `attending = true` | Party/response count (unchanged unit). |
| **Not Attending** | count of parties with `attending = false` | Party/response count. |

Remove the **Invited** box and the **Plus Ones** box.

Unit note (important, drives everything): three of the four boxes count **parties** (response counts); **Total Guests Invited** is the only **people** headcount (a sum of reserved seats). This is intentional and matches Nicolle's formula "RSVP Received = attending + not attending." A future optional 5th box could sum actual people attending (Σ `rsvpdCount` where attending) — not built this round.

### Data model (`prisma/schema.prisma`, `Guest` model)

Add four nullable columns (nullable so existing 64 rows migrate cleanly; Nicolle backfills):

| Field | Type | Meaning |
|---|---|---|
| `partnerFirstName` | `String?` | Second invitee's first name (couples/co-residents). Enables "match on either name" and "A & B" display. |
| `partnerLastName` | `String?` | Second invitee's last name. |
| `reservedSeats` | `Int?` | Invited capacity for this party ("number in party"). Sums into Total Guests Invited **and** caps the RSVP. |
| `rsvpdCount` | `Int?` | Number actually RSVP'd ("Number RSVP'd" — what the guest/coordinator enters). |

`songRequest` (a.k.a. "Favorite Song") already exists — no schema change, just surface it in the modal with that label.

Migration: `prisma migrate dev --name guest_party_fields`, additive only. No data loss.

### The reserved-seats cap invariant

**`rsvpdCount` must never exceed `reservedSeats`.** Enforced server-side in both `POST` and `PUT /api/admin/guests/[id]`: if `rsvpdCount != null && reservedSeats != null && rsvpdCount > reservedSeats`, return `400` with a clear message (e.g. "RSVP count (9) exceeds reserved seats (7) for this party"). Concrete case Nicolle gave: Callie Clark's party is 7 → she can't be recorded as bringing more than 7. The client also disables save / shows inline error, but the server is the source of truth.

### Partner-name matching (`lib/rsvp.ts`)

The public RSVP matcher currently matches a submission to a guest by email or by unambiguous `firstName`/`lastName`. Extend the name path so a submission also matches when the submitted name equals a guest's `partnerFirstName`/`partnerLastName`. This is what makes the second-name field earn its keep: if we invited both Andre and Chloe and Chloe replies, she matches the same party row instead of creating a duplicate.

Preserve the existing security invariant from the RSVP redesign: **a name match must never overwrite the email already on file.** Overlaps are rare (Nicolle's words), so exactly-two-names is sufficient; no household roster.

### Edit modal (`app/admin/guests/page.tsx`, the `editingGuest` block)

- **Resize:** the modal container is `max-h-96` (384px), which clips fields and the Save button — this is Nicolle's "resize so all fields are visible" complaint. Change to `max-h-[85vh]` with `overflow-y-auto` so the whole form and Save button are always reachable.
- **Add fields:** Partner First Name, Partner Last Name, Reserved Seats (number), Number RSVP'd (number), Favorite Song (text, bound to `songRequest`). Client-side guard: Number RSVP'd input shows an inline error and blocks save when it exceeds Reserved Seats.

### Guest list columns

Change the table to Nicolle's requested columns: **Name · Status · Number in party · Number RSVP'd · Actions (View/Edit/Delete)**.

- **Name** displays the couple combined: `"Andre Justen-Pratt & Chloe Hirai"` when partner fields are present, else `"FirstName LastName"`. A single `formatPartyName(guest)` helper produces this; reuse it everywhere the party is named (row, modals, delete confirm).
- **Number in party** = `reservedSeats` (blank if unset).
- **Number RSVP'd** = `rsvpdCount` (blank if unset).
- Drop the current "Contact" and "RSVP Details" columns from the main row (contact stays in the View modal).

## Testing

- **Unit — stats:** `reservedSeats` sum = Total Guests Invited; `rsvpReceived == attending + notAttending`; invited/plusOnes no longer returned.
- **Unit — cap invariant:** PUT/POST reject `rsvpdCount > reservedSeats` (400); accept equal; accept either being null.
- **Unit — matching:** a submission matching `partnerFirstName`/`partnerLastName` resolves to the existing party; email on file is not overwritten by a name match.
- **Unit — `formatPartyName`:** couple → "A & B"; single → "A"; missing last name handled.
- **Route:** `/api/admin/guests` POST/PUT — 401 unauthenticated, 400 on cap violation, happy path (existing mocked-session pattern).
- **Manual smoke (dev):** backfill Callie Clark reservedSeats=7, try rsvpdCount=9 → blocked; set couple partner fields → row shows "A & B"; stat boxes show 4 with correct totals; edit modal fully visible with Save reachable.

## Operational notes

- Additive migration; deploy is a normal merge → Railway `prisma migrate deploy` (already in the `start` script).
- The 64 production rows get `null` for the new fields; Nicolle backfills `reservedSeats` (drives the 117) and partner names for the couples she's currently cramming into one field.
- No email is sent by any change in this round (send relocation is deferred).
