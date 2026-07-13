# Honeymoon Registry (Stripe) — Design

**Date:** 2026-07-12
**Status:** Approved — pending spec review
**Stakeholders:** Whitney (dev), Emme & Connor (couple / registry owners), Nicolle (coordinator — wants visibility into who gave what), Connor (setting up the Stripe account)
**Context:** Emme & Connor want a honeymoon fund for their Ireland trip. Nicolle initially pushed Venmo, but plain peer-to-peer Venmo can't capture who-gave-to-what, auto-send receipts, or produce a report. We evaluated options and chose **Stripe Checkout**, which the existing schema was already designed for.

## Why

Emme's vision: guests pick a fun "treat" tier (coffee, breakfast, … a round of golf) or contribute toward a bigger goal (flight, hotel). Each gift is captured with who gave it and toward what, triggers an automatic thank-you/receipt from Emme & Connor, and feeds a report Nicolle & Emme use when writing thank-you cards (which can reference the specific activity a guest funded).

## Scope

**In:** Seeded registry tiers; public `/registry` page with gift cards + progress bars on goal items; Stripe Checkout payment flow; Stripe webhook that records contributions; automatic receipt email; admin registry report (who/what/amount/message/thank-you status) with CSV export and light tier management; wiring the dashboard "Registry & Gifts" tile (currently a dead link) to the new admin page.

**Out (deferred / not this round):** recurring gifts; refunds UI (handle in the Stripe dashboard); public donor wall; multi-currency (USD only); editing receipt-email copy from the UI; the photo-upload feature (separate, paused mid-design).

## Data model — already exists (no migration)

`RegistryItem` and `Contribution` are already in `prisma/schema.prisma` and were built for Stripe (`stripePaymentIntentId`, `stripeChargeId`, `thankYouSent`/`thankYouSentAt`). No schema change is required — only a seed script for the tiers.

**Seed the seven tiers** (`RegistryItem` rows; `isActive: true`, `sortOrder` ascending):

| Title | Amount ($) | Type | `category` | `targetAmount` |
|---|---|---|---|---|
| Buy us Coffee | 25 | fixed | dining | 25 |
| Buy us Breakfast | 50 | fixed | dining | 50 |
| Buy us Lunch | 75 | fixed | dining | 75 |
| Buy us Dinner | 100 | fixed | dining | 100 |
| Buy us a Round of Golf | 250 | fixed | activities | 250 |
| Help us pay for the Flight | variable | goal | flights | e.g. 2000 (Emme/Connor set) |
| Help us pay for the Hotel | 500 | goal | accommodation | 500 |

- **Fixed tiers** charge exactly their amount per gift (can be gifted many times).
- **Goal tiers** (Flight, Hotel) show a public progress bar (`amountRaised` / `targetAmount`). **Flight** is variable — the donor enters any amount (min $5) toward the couple-set target. **Hotel** is a fixed **$500** gift with `targetAmount` $500, so its bar reads 0% until someone gifts it, then 100% (multiple gifts are allowed and simply exceed 100%).
- `targetAmount` for fixed tiers is cosmetic (equals the price); progress bars are only rendered for goal-type items. Type ("fixed" vs "goal") is derived in code from `category` (`flights`/`accommodation` → goal) — no schema field needed.

## Public registry page (`app/(public)/registry/page.tsx`, route `/registry`)

- Fetches active `RegistryItem`s (server component or via a public `GET /api/registry`), rendered as a responsive card grid in the site's green/gold theme. Each card: image, title, short description, amount (or "Choose an amount" for Flight), and a **"Gift this"** button.
- **Goal cards (Flight, Hotel)** show a progress bar: "$X of $Y raised." No names or individual amounts are ever shown publicly.
- Clicking **Gift this** opens a small modal: **Name** (required), **optional message to the couple**, and — for Flight only — an **amount** field (min $5). Submitting calls `POST /api/registry/checkout`.
- Page copy states these are **gifts toward the honeymoon, not tax-deductible donations.**
- This `/registry` URL is the target for the QR/link Emme shares.

## Payment flow (Stripe Checkout)

1. `POST /api/registry/checkout` (public) — body `{ registryItemId, name, message?, amount? }`. Server loads the `RegistryItem`, computes the charge amount (item amount for fixed; validated donor amount for Flight, min $5), and creates a **Stripe Checkout Session** (`mode: 'payment'`) with:
   - inline `price_data` (USD, `unit_amount` in cents, `product_data.name` = tier title) — no pre-created Stripe Products needed;
   - `metadata: { registryItemId, contributorName: name, contributorMessage: message ?? '' }`;
   - Checkout collects the **card + email** (Apple/Google Pay supported automatically);
   - `success_url` → `/registry/thank-you`, `cancel_url` → `/registry`.
   Returns `{ url }`; the client redirects to Stripe's hosted page. (Only `STRIPE_SECRET_KEY` is needed server-side; no client Stripe.js.)
2. Guest pays on Stripe's hosted page.
3. **Webhook** `POST /api/webhooks/stripe` — verifies the Stripe signature with `STRIPE_WEBHOOK_SECRET` against the **raw** request body (route runs on the Node runtime; body read as text, not parsed). On `checkout.session.completed`:
   - extract `payment_intent`, `amount_total`, `customer_details.email`, and `metadata` (name, message, registryItemId);
   - **idempotently** create a `Contribution` (unique `stripePaymentIntentId` guards double-fires): `contributorName` from metadata, `contributorEmail` from Stripe, `amount`, `registryItemId`, `stripePaymentIntentId`, `stripeChargeId`, `paymentStatus: 'paid'`;
   - increment the tier's `amountRaised` by the gift amount;
   - send the receipt email (below) and set `thankYouSent`/`thankYouSentAt`.
   - Always return `200` quickly; email/DB failures are logged, not surfaced to Stripe (retries handled by idempotency).

## Receipt / thank-you email

- Sent via the existing `lib/email.ts` (Resend), from the **already-verified `walters-pierce-wedding.com` sender** used for RSVPs, with the **display name "Emme & Connor"** (e.g. `Emme & Connor <coordinator@walters-pierce-wedding.com>`) — no new email/domain setup.
- A new template `generateRegistryThankYouEmail({ name, tierTitle, amount })` in `lib/email-templates.ts`, warm and personal ("Thank you so much for the [Round of Golf] — we can't wait…"), HTML + text, same theme wrapper as the other templates. Never claims tax-deductibility.
- Logged to `EmailLog` like other sends; sets `Contribution.thankYouSent = true`.

## Admin registry page (`app/admin/registry/page.tsx`, route `/admin/registry`)

Wires up the dashboard "Registry & Gifts" tile (currently a dead link) and delivers the report Nicolle & Emme asked for:

- **Contributions table:** contributor name, tier, amount, message, date, thank-you status. Sortable; totals row.
- **Per-tier summary:** each tier with total raised and gift count (and progress vs. target for goal items).
- **CSV export** (`GET /api/admin/registry/export`) — the list that feeds handwritten thank-you cards, including the message and which activity was funded.
- **Light tier management:** edit a tier's title/description/image/target, reorder (`sortOrder`), and toggle `isActive`. Add/remove tiers is possible but low priority (the seed covers Emme's list).
- Admin-gated with the same `getServerSession` + `role === 'admin'` pattern as every other admin route.

## Security & operational notes

- **Amounts are admin-only.** The public page shows tier prices and goal progress totals, never a name-to-amount mapping.
- **Webhook signature verification is mandatory** — an unsigned/invalid request is rejected `400`. This is the only trusted source that writes `Contribution` rows (the checkout endpoint never marks anything paid).
- **Idempotency** via the unique `stripePaymentIntentId` — Stripe may deliver a webhook more than once.
- **New dependency:** `stripe` (server SDK).
- **Env vars (added by Whitney/Connor to Railway; Claude never handles keys):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. (`STRIPE_PUBLISHABLE_KEY` only if we later add client-side Stripe.js — not needed for hosted Checkout.)
- **Stripe test mode** is used for all development/verification (test keys + Stripe CLI to replay webhooks); switch to live keys at launch.
- These are **gifts, not tax-deductible donations** — reflected in page and email copy; no tax claims anywhere.

## Testing

- **Unit — checkout route:** builds a Session with correct amount for a fixed tier; validates Flight custom amount (rejects < $5); 400 on unknown/inactive item; metadata carries name + message.
- **Unit — webhook:** rejects a bad signature (400); on a valid `checkout.session.completed`, creates one `Contribution` with the right fields, increments `amountRaised`, and is idempotent on a duplicate event (no second row, no double increment); sends the receipt and sets `thankYouSent`.
- **Unit — receipt template:** includes tier + amount, no tax-deductibility language (mirrors existing template tests).
- **Route — admin registry:** 401 unauthenticated; happy path returns contributions + totals; CSV export shape.
- **Manual smoke (Stripe test mode):** gift a fixed tier and the variable Flight end-to-end with a test card; confirm the contribution appears in admin, `amountRaised` moves, the progress bar updates, and the receipt email arrives.

## Prerequisites (not code)

1. Connor creates the Stripe account; Whitney adds `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` to Railway (and local `.env` with **test** keys for development).
2. Register the webhook endpoint (`/api/webhooks/stripe`) in the Stripe dashboard for `checkout.session.completed`.
3. Emme/Connor confirm the Flight `targetAmount` (goal) and provide/approve tier images (optional — cards work without images).
