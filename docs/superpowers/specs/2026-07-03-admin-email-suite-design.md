# Admin Email Suite — Proxy RSVPs & One-Click Reminders

**Date:** 2026-07-03
**Status:** Draft for approval
**Stakeholders:** Whitney (dev), Nicolle (acting Wedding Coordinator — primary user), Emme & Connor
**Context:** The RSVP redesign is live in production (65 guests, 0 responses yet). Nicolle operates `/admin/rsvps`. A professional wedding coordinator will take over closer to the date (see Handoff section).

## Why

Two gaps in the live system:
1. **Not everyone RSVPs through a website.** Grandparents and other non-tech-savvy family will phone in. Nicolle needs to record and edit RSVPs on their behalf — today she has no way to enter party size or song requests manually.
2. **Chasing non-responders is the biggest email chore of any wedding.** The panel already counts "invited, not yet responded" but offers no way to nudge them.

Trust model (decided): **one-click bulk** — nothing sends without Nicolle pressing a button. No scheduler, no rule-based drips.

## Feature 1 — Proxy RSVP entry ("Record RSVP")

- Every guest row in `/admin/rsvps` gets a **Record RSVP** action (label switches to **Edit RSVP** when a response exists), opening a modal: attending yes/no, party size (1–10, required when attending), dietary restrictions, song request. Pre-filled from the existing record when editing.
- An **"Add guest + RSVP"** button covers people not in the guest table (e.g., a grandparent who never got a save-the-date): first/last name, email (optional — some elders have none; see below), plus the same RSVP fields.
- Semantics:
  - Writes the same response fields as the public flow (`attending`, `partySize`, `dietaryRestrictions`, `songRequest`, `rsvpReceivedAt`).
  - **No blocklist check** (Nicolle is the trusted operator) and **no notification email** (she'd be notifying herself). Silent by design.
  - Every entry writes an `AuditLog` row, action `rsvp_admin_entry`, with old/new values — so "guest submitted" vs "coordinator entered" is always distinguishable from `audit_log` + absence/presence of an `rsvp_notification` email log.
  - Guests created here get `source = 'imported'` (entered by the coordinator ⇒ on the list by definition; they appear in the matched buckets).
  - **Email-less guests:** email is optional on admin entry only. Stored as a placeholder `no-email+<uuid>@walters-pierce-wedding.invalid` to satisfy the unique constraint; the UI shows "no email" instead; the send flow **excludes** these addresses automatically (they can never be selected for gated emails). The `.invalid` TLD guarantees nothing can ever actually deliver.
- New pieces:
  - `lib/rsvp.ts`: `recordAdminRsvp(input)` where input is `{ guestId } | { firstName, lastName, email? }` plus the response fields. Shares a response-data builder with `processRsvpSubmission` (extract the existing object literal into a small helper — no behavior change to the public path).
  - `POST /api/admin/rsvps/record` — admin-gated (same `getServerSession` pattern), zod-validated, calls `recordAdminRsvp`, returns the updated guest row.

## Feature 2 — RSVP reminders (one-click bulk)

- Third template in the existing send dropdown: **"RSVP reminder."**
  - Content: warm, from the coordinator identity, "we'd love to know if you can join us — please RSVP at walters-pierce-wedding.com/rsvp." **Never contains date specifics beyond "September 2026," never venue.** Both HTML + text parts, same theme wrapper.
  - Uses the existing preview → confirm → throttled-send → per-recipient-results pipeline unchanged. Logged as `emailType: 'gated_rsvp_reminder'`.
- Panel helpers:
  - A **"Non-responders" section** appears above the four buckets listing guests with `rsvpReceivedAt == null` (all sources), with the same checkbox selection. (Currently non-responders are counted but not listed — this makes them selectable.)
  - **"Select all non-responders"** button (excludes placeholder-email guests).
  - **"Reminded" column** in that section derived from existing email history: count + date of `gated_rsvp_reminder` sends (e.g., "1× on 8/1"). No hard cap — Nicolle sees the count and decides; the confirm dialog repeats how many of the selected were already reminded.
- Bounce safety (small, high-value): the send flow skips guests whose most recent email log has `status: 'bounced'` and reports them as skipped in the results, so dead addresses never accumulate re-sends. (Applies to all three templates.)

## Out of scope (deliberate — YAGNI)

- Scheduled sends, rule-based drips (explicitly rejected in favor of one-click bulk)
- Free-form compose, logistics/thank-you templates, details re-send (future conversations)
- Editing template copy from the UI
- Rewriting the legacy save-the-date campaign pages (separate effort; their copy is stale)

## Coordinator handoff (documentation, not code)

When the hired wedding coordinator takes over from Nicolle:
1. **Notifications:** set `NOTIFY_EMAIL=<coordinator's address>` in Railway (currently unset ⇒ defaults to lnawalters@protonmail.com). One variable, no deploy beyond restart.
2. **Portal access:** create the coordinator an admin user via the existing admin users page (role `admin`), or share credentials per family preference.
3. **Reply-To on guest emails** is `NOTIFY_EMAIL`, so replies follow the same variable automatically.
4. The sending identity is already impersonal ("Wedding Coordinator <coordinator@walters-pierce-wedding.com>") — nothing guest-visible changes at handoff.

## Testing

- Unit: `recordAdminRsvp` — update path, create path (with + without email), placeholder-email generation, audit row written, no email sent (mock asserts sendEmail never called).
- Unit: reminder template (no venue/date leakage assertions, mirrors gracious-regrets test).
- Unit: bounce-skip logic in the send path.
- Route: `/api/admin/rsvps/record` — 401 unauthenticated, 400 invalid, happy path (mocked session pattern from existing route tests).
- Manual smoke on dev: record a phone RSVP for a name-only guest; verify buckets, audit row, and that the guest cannot be selected for sends.

## Operational notes

- Resend volume: reminders to ~57 non-responders ≈ one send burst well within limits; existing 600ms throttle applies.
- Production rollout is a normal merge → Railway deploy; no migration needed (no schema changes — placeholder emails reuse the existing unique `email` column).
