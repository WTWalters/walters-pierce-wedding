# Email Analytics Tab — Design Spec

**Date:** 2026-07-18
**Status:** Approved (design), pending spec review
**Author:** Whitney + Claude

## Problem

Nicolle needs visibility into the emails the wedding site sends: **who got what and when, whether it bounced (wrong address), and whether the recipient opened it**, plus other useful deliverability stats from Resend. Today there is no admin surface for this — email activity is invisible except for a small per-guest list buried in the To Review detail modal.

## Key finding: the backend already exists

Most of the plumbing is already built and deployed, so this project is primarily a **UI on top of existing tracking** plus a stats fix:

- **Resend webhook** — `app/api/webhooks/resend/route.ts` (committed `39e4971`, `2b07c48`, deployed) verifies Svix signatures and records `email.delivered → status:'delivered'`, `email.opened → openedAt`, `email.bounced → bouncedAt + status:'bounced'`, `email.complained → status:'complained'`, matching rows by `resendMessageId`.
- **`EmailLog` model** already has every needed column: `recipientEmail`, `emailType`, `subject`, `status`, `sentAt`, `openedAt`, `clickedAt`, `bouncedAt`, `resendMessageId`, and an optional `guest` relation. **No schema change / migration is required.**
- **Every send is logged** via `logEmail(...)` with a `resendMessageId`.
- A stale `GET /api/admin/email/stats` exists but is now **incorrect**: it counts `status:'sent'` as "delivered", but the webhook now flips delivered rows to `status:'delivered'`, so genuinely-delivered emails are undercounted. This endpoint will be rewritten.

## Scope

Show **all logged sends**, with a **type filter**. This includes guest-facing emails (RSVP confirmations, save-the-dates, the gated Yes/No/Incorrect/venue/regrets notes, registry thank-yous) **and** the two internal notifications addressed to the coordinator (`rsvp_notification`, `blocked_attempt_notification`). Nicolle can filter by type.

**Out of scope (YAGNI, deferred to a possible "approach C"):** click-tracking (`email.clicked` → `clickedAt`), CSV export, per-guest drilldown, date-range filters.

## Architecture

Three code units + one config step. No new data model.

### 1. List API — `GET /api/admin/emails`

- Admin-guarded (session role check → 401 otherwise), same pattern as the other `/api/admin/*` routes.
- Returns email rows **newest-first** (`orderBy: { sentAt: 'desc' }`), capped at the latest **500** rows (avoids an unbounded payload; note the cap in the response and UI if hit).
- Optional `?type=<emailType>` query param filters by exact `emailType`.
- Each row returns: `id`, `recipientEmail`, `emailType`, `subject`, `sentAt`, `status`, `openedAt`, `bouncedAt`, `clickedAt`, and `guestName` (from the optional `guest` relation, or null).
- Returns `{ emails: [...], total, capped: boolean }`.

### 2. Stats API — rewrite `GET /api/admin/email/stats`

Admin-guarded. Returns the six tiles, computed with correct semantics:

| Tile | Definition |
|---|---|
| **Sent** | Rows successfully handed to Resend = `count(status != 'failed')` |
| **Delivered** | `count(status = 'delivered' OR openedAt != null)` (an open implies delivery) |
| **Opened** | `count(openedAt != null)`, plus `openRate = opened / delivered` (0 when delivered = 0) |
| **Bounced** | `count(bouncedAt != null)` |
| **Failed** | `count(status = 'failed')` |
| **Spam** | `count(status = 'complained')` |

Return shape: `{ sent, delivered, opened, openRate, bounced, failed, complained }`.

### 3. UI — `/admin/emails` page + nav tab

- New nav link **"Emails"** in `app/admin/layout.tsx`, placed after "To Review".
- Page fetches stats + list on load.
- **Six stat tiles** at the top (Sent · Delivered · Opened w/ rate · Bounced · Failed · Spam).
- **Type-filter dropdown** — re-fetches the list from the server with `?type=` (server-side filter, so it stays accurate even if total emails exceed the 500 cap). Friendly labels map raw types (e.g. `gated_rsvp_yes` → "RSVP Yes", `save_the_date` → "Save-the-Date", `rsvp_notification` → "New-RSVP alert (to you)").
- **Table**, one row per email: **Recipient · Type · Subject · Sent (date/time, Denver) · Status badge.**
- **Derived status badge** per row, first match wins:
  1. **Failed** (`status = 'failed'`) — grey/red "Failed to send"
  2. **Bounced** (`bouncedAt != null` or `status = 'bounced'`) — red
  3. **Spam** (`status = 'complained'`) — orange
  4. **Opened** (`openedAt != null`) — green
  5. **Delivered** (`status = 'delivered'`) — blue
  6. **Sent** (default) — grey "Sent (pending confirmation)"

### 4. Config (no code — needs Whitney/Connor)

For opens/bounces/deliveries to populate, in the Resend dashboard:
1. Register a webhook to `https://walters-pierce-wedding.com/api/webhooks/resend` for events: `email.delivered`, `email.opened`, `email.bounced`, `email.complained`.
2. Set `RESEND_WEBHOOK_SECRET` (the endpoint's signing secret) in Railway.
3. Enable **Open Tracking** (adds a tracking pixel; without it `email.opened` never fires).

Claude will verify current state where possible (the webhook route returns 503 if `RESEND_WEBHOOK_SECRET` is unset — a quick signal). **Backfill caveat:** only emails sent *after* config is live get delivery/open/bounce data; pre-existing `EmailLog` rows display as "Sent."

## Data flow

```
guest/admin action → sendEmail() → Resend (returns message id)
                   → logEmail(resendMessageId, status:'sent')   [row created]

Resend async events → POST /api/webhooks/resend (svix-verified)
                   → EmailLog.updateMany({resendMessageId}, {openedAt|bouncedAt|status})

Admin opens /admin/emails
   → GET /api/admin/email/stats  → six tiles
   → GET /api/admin/emails[?type] → table rows (newest 500)
```

## Error handling

- Both APIs: 401 when not an admin; 500 with a logged error on DB failure (page shows a friendly "couldn't load" message).
- List cap (500) surfaced so a truncated view is never mistaken for "all email."
- Webhook already fails safe: 503 if unconfigured, 400 on bad signature, and `updateMany` is a no-op when no row matches a `resendMessageId` (idempotent — safe for Resend retries).

## Testing

- **Stats aggregation** (unit, mocked Prisma counts): each status/timestamp maps to the correct tile; `openRate` handles delivered = 0 (no divide-by-zero); opened implies delivered.
- **List API** (unit): admin-guard 401; `?type=` filters to exact type; newest-first ordering; cap applied; row shape includes `guestName`.
- Existing webhook tests remain green (no webhook changes in this pass).

## Files

- `app/api/admin/emails/route.ts` — new list endpoint (+ `__tests__/`).
- `app/api/admin/email/stats/route.ts` — rewrite (+ test).
- `app/admin/emails/page.tsx` — new page (stat tiles, filter, table, status badges).
- `app/admin/layout.tsx` — add "Emails" nav tab.
- Optional shared helper for the raw-type → friendly-label map and the derived-status function (colocated or in a small `lib/email-status.ts`) so the page and any future consumer agree.
