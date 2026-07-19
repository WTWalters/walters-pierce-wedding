# Registry Links in Emails + Decline-Flow Button — Design Spec

**Date:** 2026-07-18
**Status:** Approved (design), pending spec review
**Author:** Whitney + Claude

## Problem

The registry (Honeymoon Fund) is reachable from the home page and the RSVP page, but **not from any email**, and a guest who **declines** doesn't get an easy path to it (they drift to the home page where the registry card is buried below the carousel). Add a registry call-to-action to the confirmation emails and put a prominent button in the decline flow.

## Scope (final, per Whitney)

- **Emails that get a registry CTA:** **RSVP-Yes** (`generateRsvpYesEmail`) and **RSVP-No** (`generateRsvpNoEmail`) only.
- **Explicitly excluded:** Venue Details and Gracious Regrets (legacy/superseded templates), Incorrect-RSVP / over-count (tonally wrong — the corrected RSVP-Yes carries the link), Save-the-Date + its confirmation (the event is past that stage), and the internal notifications to the coordinator (new-RSVP alert, blocked-attempt).
- **RSVP page decline behavior:** add a prominent "Visit our Honeymoon Fund" button to the **decline branch of the confirmation modal**; keep the gentle drift back to the homepage (no forced redirect for decliners).
- **Unchanged:** the existing home-page Honeymoon Fund card + footer link, and the RSVP page's existing registry link and attending-redirect.

## Existing building blocks

- `lib/email-templates.ts` renders all templates through a shared `wrap(title, bodyHtml)` helper; `generateRsvpYesEmail` / `generateRsvpNoEmail` each return `{ subject, html, text }`.
- The RSVP confirmation modal (`app/(public)/rsvp/page.tsx`) already shows a `Go to the Honeymoon Fund now` button in the **attending** branch (`/registry`, forest-green button). The decline branch currently shows only the "we'll miss you" copy + a "taking you back" note.
- Absolute site URL: `process.env.NEXT_PUBLIC_SITE_URL` (set in Railway = `https://walters-pierce-wedding.com`).

## Architecture

### 1. Shared registry CTA snippet (DRY) — `lib/email-templates.ts`

A small module-level helper so both emails share identical wording/styling:
```ts
function registryCta(): { html: string; text: string }
```
- Builds an absolute URL: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://walters-pierce-wedding.com'}/registry`.
- **html:** a centered branded button — forest-green background (`#00330a`), gold text (`#D4AF37`), rounded — label **"Visit our Honeymoon Fund 🎁"**, matching the site's palette and the existing email style.
- **text:** a plain line — `Visit our Honeymoon Fund: <url>`.

### 2. Wire it into the two emails

- `generateRsvpYesEmail`: append `registryCta().html` to the end of the body (after the venue block) and `registryCta().text` to the end of the text body.
- `generateRsvpNoEmail`: append the same after the "sorry to miss you" paragraph / text.
- No signature changes; the CTA takes no arguments.

### 3. Decline-flow button — `app/(public)/rsvp/page.tsx`

In the decline (`else`) branch of the confirmation modal, add a Honeymoon Fund button styled like the attending branch's button (forest-green, `→ /registry`), placed above the "taking you back to the website" note so it's the clear, immediate action. The existing 7-second drift to the homepage stays.

## Data flow

```
Nicolle sends RSVP-Yes/No via the dropdown → generateRsvpYes/NoEmail → body + text
   now end with the registryCta() button/link → guest taps → /registry

Guest declines on the RSVP page → confirmation modal (decline branch)
   → prominent "Visit our Honeymoon Fund" button (no scroll/hunt) + gentle drift home
```

## Error handling / edge cases

- `NEXT_PUBLIC_SITE_URL` unset → falls back to the production domain, so the link is never relative/broken in an email client.
- CTA is static content — no failure modes; it renders identically regardless of guest data.

## Testing

- `generateRsvpYesEmail` and `generateRsvpNoEmail`: assert both `html` **and** `text` contain `/registry` and the "Honeymoon Fund" label.
- Assert an **internal** template (`generateRsvpNotificationEmail`) does **NOT** contain `/registry` (guards against the CTA leaking into coordinator notifications).
- Assert the over-count email (`generateRsvpOverCountEmail`) does **NOT** contain `/registry` (confirms the deliberate exclusion).
- Existing email/template tests stay green.
- The RSVP page decline button is verified by production build (client page).

## Files

- `lib/email-templates.ts` — add `registryCta()`; append it in `generateRsvpYesEmail` + `generateRsvpNoEmail`.
- `lib/__tests__/email-templates.test.ts` and/or `lib/__tests__/rsvp-messages.test.ts` — CTA-present / CTA-absent assertions.
- `app/(public)/rsvp/page.tsx` — decline-branch Honeymoon Fund button.

## Out of scope (YAGNI)

- Registry links in any other email.
- Any change to the home page or the existing RSVP-page entry points.
- Changing the decline redirect destination (stays homepage).
