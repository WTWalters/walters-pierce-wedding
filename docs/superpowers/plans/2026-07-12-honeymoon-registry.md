# Honeymoon Registry (Stripe) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A honeymoon fund where guests gift toward preset tiers (or a variable Flight amount) via Stripe Checkout, each gift is recorded with who/what/amount, an automatic "Emme & Connor" receipt is sent, and Nicolle & Emme get an admin report + CSV.

**Architecture:** Public `/registry` page reads seeded `RegistryItem` tiers and opens Stripe Checkout via `POST /api/registry/checkout`. Stripe's signed webhook (`/api/webhooks/stripe`) is the only writer of `Contribution` rows — it records the gift idempotently, bumps `amountRaised`, and sends the receipt. Admin `/admin/registry` reports contributions and exports CSV. Pure logic lives in `lib/registry.ts`; the Stripe client in `lib/stripe.ts`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma 6 + PostgreSQL, Stripe Node SDK, Resend (existing), Jest.

**Spec:** `docs/superpowers/specs/2026-07-12-honeymoon-registry-design.md`

**Prerequisites (human, before verification):** Connor's Stripe account exists. Whitney adds `STRIPE_SECRET_KEY` (test) to `.env.local`; for the webhook, `STRIPE_WEBHOOK_SECRET` comes from `stripe listen` locally (Task 13) and from a dashboard endpoint in production. The schema (`RegistryItem`, `Contribution`) already exists — no migration.

## File structure

- `lib/stripe.ts` (new) — lazy Stripe client singleton.
- `lib/registry.ts` (new) — pure helpers: `tierType`, `isVariable`, `resolveChargeCents`.
- `scripts/seed-registry.mjs` (new) — seed the 7 tiers (idempotent).
- `app/api/registry/route.ts` (new) — public GET list of active tiers.
- `app/api/registry/checkout/route.ts` (new) — public POST → Stripe Checkout Session.
- `app/api/webhooks/stripe/route.ts` (new) — signed webhook → records Contribution.
- `lib/email-templates.ts` (modify) — add `generateRegistryThankYouEmail`.
- `lib/email.ts` (modify) — add `EMME_CONNOR_FROM` constant.
- `app/(public)/registry/page.tsx` (new) — public gift page.
- `app/(public)/registry/thank-you/page.tsx` (new) — post-payment page.
- `app/api/admin/registry/route.ts` (new) — admin GET report.
- `app/api/admin/registry/[id]/route.ts` (new) — admin PUT tier edit.
- `app/api/admin/registry/export/route.ts` (new) — admin GET CSV.
- `app/admin/registry/page.tsx` (new) — admin report + tier management.
- `package.json` — add `stripe`.

---

### Task 1: Install Stripe SDK + client singleton

**Files:**
- Modify: `package.json`
- Create: `lib/stripe.ts`

- [ ] **Step 1: Install the Stripe Node SDK**

Run: `npm install stripe`
Expected: `stripe` appears in `package.json` dependencies.

- [ ] **Step 2: Create the client singleton** — `lib/stripe.ts`:

```typescript
import Stripe from 'stripe'

let client: Stripe | null = null

/** Lazy Stripe client. Throws if the secret key is not configured. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  if (!client) client = new Stripe(key)
  return client
}
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit 2>&1 | grep -i "lib/stripe.ts" || echo clean`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json lib/stripe.ts
git commit -m "feat(registry): add stripe sdk + client singleton"
```

---

### Task 2: Registry pure helpers

**Files:**
- Create: `lib/registry.ts`
- Test: `lib/__tests__/registry.test.ts`

- [ ] **Step 1: Write the failing test** — `lib/__tests__/registry.test.ts`:

```typescript
import { tierType, isVariable, resolveChargeCents } from '@/lib/registry'

describe('tierType', () => {
  it('flights and accommodation are goal tiers (progress bar)', () => {
    expect(tierType('flights')).toBe('goal')
    expect(tierType('accommodation')).toBe('goal')
  })
  it('dining and activities are fixed tiers', () => {
    expect(tierType('dining')).toBe('fixed')
    expect(tierType('activities')).toBe('fixed')
  })
})

describe('isVariable', () => {
  it('only flights lets the donor choose the amount', () => {
    expect(isVariable('flights')).toBe(true)
    expect(isVariable('accommodation')).toBe(false)
    expect(isVariable('dining')).toBe(false)
  })
})

describe('resolveChargeCents', () => {
  it('charges the tier target for a fixed item', () => {
    expect(resolveChargeCents({ category: 'dining', targetAmount: 25 }))
      .toEqual({ ok: true, cents: 2500 })
  })
  it('charges the donor amount for the variable Flight (min $5)', () => {
    expect(resolveChargeCents({ category: 'flights', targetAmount: 2000 }, 120))
      .toEqual({ ok: true, cents: 12000 })
  })
  it('rejects a Flight amount below $5 or missing', () => {
    expect(resolveChargeCents({ category: 'flights', targetAmount: 2000 }, 3).ok).toBe(false)
    expect(resolveChargeCents({ category: 'flights', targetAmount: 2000 }).ok).toBe(false)
  })
  it('charges the fixed $500 for the Hotel (accommodation, not variable)', () => {
    expect(resolveChargeCents({ category: 'accommodation', targetAmount: 500 }))
      .toEqual({ ok: true, cents: 50000 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/__tests__/registry.test.ts`
Expected: FAIL ("Cannot find module '@/lib/registry'").

- [ ] **Step 3: Implement** — `lib/registry.ts`:

```typescript
export type TierType = 'fixed' | 'goal'

/** Goal tiers (flights, accommodation) render a public progress bar. */
export function tierType(category: string): TierType {
  return category === 'flights' || category === 'accommodation' ? 'goal' : 'fixed'
}

/** Only the Flight (flights) lets the donor enter their own amount. */
export function isVariable(category: string): boolean {
  return category === 'flights'
}

export type ChargeResult = { ok: true; cents: number } | { ok: false; message: string }

/**
 * The amount to charge, in cents. Variable items use the donor's dollar amount
 * (min $5); every other item charges its `targetAmount`.
 */
export function resolveChargeCents(
  item: { category: string; targetAmount: number },
  requestedDollars?: number
): ChargeResult {
  if (isVariable(item.category)) {
    if (requestedDollars == null || !(requestedDollars >= 5)) {
      return { ok: false, message: 'Please enter an amount of at least $5.' }
    }
    return { ok: true, cents: Math.round(requestedDollars * 100) }
  }
  return { ok: true, cents: Math.round(Number(item.targetAmount) * 100) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/__tests__/registry.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/registry.ts lib/__tests__/registry.test.ts
git commit -m "feat(registry): tier-type + charge-amount helpers"
```

---

### Task 3: Seed the seven tiers

**Files:**
- Create: `scripts/seed-registry.mjs`

- [ ] **Step 1: Write the idempotent seed script** — `scripts/seed-registry.mjs`:

```javascript
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const TIERS = [
  { title: 'Buy us Coffee',            description: 'Fuel a cozy Irish morning.',            targetAmount: 25,   category: 'dining',        sortOrder: 1 },
  { title: 'Buy us Breakfast',         description: 'A hearty start before the day’s adventures.', targetAmount: 50, category: 'dining',   sortOrder: 2 },
  { title: 'Buy us Lunch',             description: 'A midday bite between the sights.',      targetAmount: 75,   category: 'dining',        sortOrder: 3 },
  { title: 'Buy us Dinner',            description: 'A romantic dinner out in Ireland.',      targetAmount: 100,  category: 'dining',        sortOrder: 4 },
  { title: 'Buy us a Round of Golf',   description: 'A round on an emerald Irish course.',    targetAmount: 250,  category: 'activities',    sortOrder: 5 },
  { title: 'Help us pay for the Flight', description: 'Chip in any amount toward our flights to Ireland.', targetAmount: 2000, category: 'flights', sortOrder: 6 },
  { title: 'Help us pay for the Hotel', description: 'A night in our honeymoon hotel.',       targetAmount: 500,  category: 'accommodation', sortOrder: 7 },
]

for (const t of TIERS) {
  const existing = await prisma.registryItem.findFirst({ where: { title: t.title } })
  if (existing) {
    console.log('skip (exists):', t.title)
    continue
  }
  await prisma.registryItem.create({ data: { ...t, isActive: true } })
  console.log('created:', t.title)
}
await prisma.$disconnect()
```

- [ ] **Step 2: Run the seed against the local DB**

Run: `node --env-file=.env scripts/seed-registry.mjs`
Expected: prints `created:` for all 7 tiers (or `skip` on re-run). Re-running must not duplicate.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-registry.mjs
git commit -m "feat(registry): seed the seven honeymoon tiers"
```

---

### Task 4: Public GET /api/registry

**Files:**
- Create: `app/api/registry/route.ts`
- Test: `app/api/registry/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test** — `app/api/registry/__tests__/route.test.ts`:

```typescript
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('@/lib/prisma', () => ({ prisma: { registryItem: { findMany: jest.fn() } } }))

import { GET } from '../route'
import { prisma } from '@/lib/prisma'
const mockPrisma = prisma as jest.Mocked<any>

it('returns active tiers with numeric amounts, sorted', async () => {
  mockPrisma.registryItem.findMany.mockResolvedValue([
    { id: 'a', title: 'Buy us Coffee', description: 'x', imageUrl: null, targetAmount: 25, amountRaised: 0, category: 'dining', sortOrder: 1 },
  ])
  const res: any = await GET()
  expect(mockPrisma.registryItem.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })
  )
  expect(res.body.items[0]).toMatchObject({ title: 'Buy us Coffee', targetAmount: 25, amountRaised: 0 })
  expect(typeof res.body.items[0].targetAmount).toBe('number')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/registry/__tests__/route.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `app/api/registry/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const rows = await prisma.registryItem.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    imageUrl: r.imageUrl,
    category: r.category,
    targetAmount: Number(r.targetAmount),
    amountRaised: Number(r.amountRaised),
  }))
  return NextResponse.json({ items })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/registry/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/registry/route.ts app/api/registry/__tests__/route.test.ts
git commit -m "feat(registry): public API listing active tiers"
```

---

### Task 5: Checkout route → Stripe Checkout Session

**Files:**
- Create: `app/api/registry/checkout/route.ts`
- Test: `app/api/registry/__tests__/checkout-route.test.ts`

- [ ] **Step 1: Write the failing test** — `app/api/registry/__tests__/checkout-route.test.ts`:

```typescript
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('@/lib/prisma', () => ({ prisma: { registryItem: { findFirst: jest.fn() } } }))
const create = jest.fn()
jest.mock('@/lib/stripe', () => ({ getStripe: () => ({ checkout: { sessions: { create } } }) }))

import { POST } from '../checkout/route'
import { prisma } from '@/lib/prisma'
const mockPrisma = prisma as jest.Mocked<any>

const req = (body: unknown) => ({ json: async () => body, url: 'https://walters-pierce-wedding.com/api/registry/checkout' }) as any

beforeEach(() => {
  jest.clearAllMocks()
  create.mockResolvedValue({ url: 'https://checkout.stripe.com/abc' })
})

it('creates a session for a fixed tier with the right amount + metadata', async () => {
  mockPrisma.registryItem.findFirst.mockResolvedValue({ id: 'a', title: 'Buy us Dinner', category: 'dining', targetAmount: 100, isActive: true })
  const res: any = await POST(req({ registryItemId: 'a', name: 'Aunt Sue', message: 'Enjoy!' }))
  expect(res.body.url).toContain('checkout.stripe.com')
  const arg = create.mock.calls[0][0]
  expect(arg.line_items[0].price_data.unit_amount).toBe(10000)
  expect(arg.line_items[0].price_data.product_data.name).toBe('Buy us Dinner')
  expect(arg.metadata).toMatchObject({ registryItemId: 'a', contributorName: 'Aunt Sue', contributorMessage: 'Enjoy!' })
})

it('rejects the variable Flight with no amount (400)', async () => {
  mockPrisma.registryItem.findFirst.mockResolvedValue({ id: 'f', title: 'Flight', category: 'flights', targetAmount: 2000, isActive: true })
  const res: any = await POST(req({ registryItemId: 'f', name: 'Sue' }))
  expect(res.status).toBe(400)
  expect(create).not.toHaveBeenCalled()
})

it('404s for an unknown/inactive item', async () => {
  mockPrisma.registryItem.findFirst.mockResolvedValue(null)
  const res: any = await POST(req({ registryItemId: 'nope', name: 'Sue' }))
  expect(res.status).toBe(404)
})

it('400s on missing name', async () => {
  const res: any = await POST(req({ registryItemId: 'a' }))
  expect(res.status).toBe(400)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/registry/__tests__/checkout-route.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `app/api/registry/checkout/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getStripe } from '@/lib/stripe'
import { resolveChargeCents } from '@/lib/registry'

const schema = z.object({
  registryItemId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  message: z.string().trim().max(500).optional(),
  amount: z.number().positive().optional(),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid submission' }, { status: 400 })
  }
  const { registryItemId, name, message, amount } = parsed.data

  const item = await prisma.registryItem.findFirst({ where: { id: registryItemId, isActive: true } })
  if (!item) return NextResponse.json({ error: 'That gift is not available.' }, { status: 404 })

  const charge = resolveChargeCents({ category: item.category, targetAmount: Number(item.targetAmount) }, amount)
  if (!charge.ok) return NextResponse.json({ error: charge.message }, { status: 400 })

  const origin = new URL(request.url).origin
  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      quantity: 1,
      price_data: { currency: 'usd', unit_amount: charge.cents, product_data: { name: item.title } },
    }],
    metadata: { registryItemId, contributorName: name, contributorMessage: message ?? '' },
    success_url: `${origin}/registry/thank-you`,
    cancel_url: `${origin}/registry`,
  })

  return NextResponse.json({ url: session.url })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/registry/__tests__/checkout-route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/registry/checkout/route.ts app/api/registry/__tests__/checkout-route.test.ts
git commit -m "feat(registry): checkout route creates a Stripe session"
```

---

### Task 6: Registry thank-you email template

**Files:**
- Modify: `lib/email.ts` (add `EMME_CONNOR_FROM`), `lib/email-templates.ts` (add template)
- Test: `lib/__tests__/registry-email.test.ts`

- [ ] **Step 1: Write the failing test** — `lib/__tests__/registry-email.test.ts`:

```typescript
import { generateRegistryThankYouEmail } from '@/lib/email-templates'

it('renders a warm receipt with tier + amount and no tax language', () => {
  const r = generateRegistryThankYouEmail({ name: 'Aunt Sue', tierTitle: 'Buy us Dinner', amount: 100 })
  expect(r.subject).toMatch(/thank you/i)
  expect(r.html).toContain('Buy us Dinner')
  expect(r.html).toContain('$100')
  expect(r.text).toContain('Aunt Sue')
  expect(`${r.html} ${r.text}`.toLowerCase()).not.toContain('tax-deductible')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/__tests__/registry-email.test.ts`
Expected: FAIL (`generateRegistryThankYouEmail` not exported).

- [ ] **Step 3: Add the sender constant** — in `lib/email.ts`, after `COORDINATOR_FROM`:

```typescript
export const EMME_CONNOR_FROM = 'Emme & Connor <coordinator@walters-pierce-wedding.com>'
```

- [ ] **Step 4: Add the template** — append to `lib/email-templates.ts` (reuses the existing `wrap` + `escapeHtml`):

```typescript
export function generateRegistryThankYouEmail(data: {
  name: string
  tierTitle: string
  amount: number
}): Rendered {
  const name = escapeHtml(data.name)
  const tier = escapeHtml(data.tierTitle)
  const amount = `$${data.amount.toLocaleString('en-US')}`
  const subject = `Thank you for your honeymoon gift, ${data.name}!`
  const body = `
    <p>Dear ${name},</p>
    <p>Thank you so much for your generous gift of <strong>${amount}</strong> toward
    <strong>${tier}</strong>. It means the world to us as we get ready for our honeymoon in Ireland.</p>
    <p>We can't wait to celebrate with you — and we'll be sure to share a photo of us enjoying it!</p>
    <p style="margin-top: 24px;">With love and gratitude,<br><strong>Emme &amp; Connor</strong></p>`
  const html = wrap('A heartfelt thank you', body)
  const text = `Dear ${data.name},\n\nThank you so much for your generous gift of ${amount} toward ${data.tierTitle}. `
    + `It means the world to us as we get ready for our honeymoon in Ireland. We can't wait to celebrate with you.\n\n`
    + `With love and gratitude,\nEmme & Connor\nwalters-pierce-wedding.com`
  return { subject, html, text }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest lib/__tests__/registry-email.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/email.ts lib/email-templates.ts lib/__tests__/registry-email.test.ts
git commit -m "feat(registry): thank-you email template + Emme & Connor sender"
```

---

### Task 7: Stripe webhook — record contribution (idempotent), bump total, send receipt

**Files:**
- Create: `app/api/webhooks/stripe/route.ts`
- Test: `app/api/webhooks/__tests__/stripe-route.test.ts`

- [ ] **Step 1: Write the failing test** — `app/api/webhooks/__tests__/stripe-route.test.ts`:

```typescript
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
const constructEvent = jest.fn()
jest.mock('@/lib/stripe', () => ({ getStripe: () => ({ webhooks: { constructEvent } }) }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contribution: { findUnique: jest.fn(), create: jest.fn() },
    registryItem: { update: jest.fn() },
  },
}))
jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'm1' }),
  logEmail: jest.fn(),
  EMME_CONNOR_FROM: 'Emme & Connor <x@y.z>',
}))
jest.mock('@/lib/email-templates', () => ({
  generateRegistryThankYouEmail: () => ({ subject: 's', html: 'h', text: 't' }),
}))

import { POST } from '../stripe/route'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
const mockPrisma = prisma as jest.Mocked<any>

const OLD_ENV = process.env
beforeEach(() => {
  jest.clearAllMocks()
  process.env = { ...OLD_ENV, STRIPE_WEBHOOK_SECRET: 'whsec_test' }
})
afterAll(() => { process.env = OLD_ENV })

const req = (raw = '{}') => ({ text: async () => raw, headers: { get: () => 'sig' } }) as any

const completedEvent = {
  type: 'checkout.session.completed',
  data: { object: {
    payment_intent: 'pi_1', amount_total: 10000,
    customer_details: { email: 'sue@example.com' },
    metadata: { registryItemId: 'a', contributorName: 'Aunt Sue', contributorMessage: 'Enjoy!' },
  } },
}

it('rejects an invalid signature (400)', async () => {
  constructEvent.mockImplementation(() => { throw new Error('bad sig') })
  const res: any = await POST(req())
  expect(res.status).toBe(400)
})

it('records the contribution, bumps the tier, and sends the receipt', async () => {
  constructEvent.mockReturnValue(completedEvent)
  mockPrisma.contribution.findUnique.mockResolvedValue(null)
  mockPrisma.contribution.create.mockResolvedValue({ id: 'c1' })
  mockPrisma.registryItem.update.mockResolvedValue({})

  const res: any = await POST(req())

  expect(res.status).toBe(200)
  const created = mockPrisma.contribution.create.mock.calls[0][0].data
  expect(created).toMatchObject({
    registryItemId: 'a', contributorName: 'Aunt Sue', contributorEmail: 'sue@example.com',
    stripePaymentIntentId: 'pi_1', paymentStatus: 'paid', thankYouSent: true,
  })
  expect(Number(created.amount)).toBe(100)
  expect(mockPrisma.registryItem.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 'a' }, data: { amountRaised: { increment: 100 } } })
  )
  expect(sendEmail).toHaveBeenCalled()
})

it('is idempotent on a duplicate event (no second row)', async () => {
  constructEvent.mockReturnValue(completedEvent)
  mockPrisma.contribution.findUnique.mockResolvedValue({ id: 'c1' }) // already recorded
  const res: any = await POST(req())
  expect(res.status).toBe(200)
  expect(mockPrisma.contribution.create).not.toHaveBeenCalled()
  expect(mockPrisma.registryItem.update).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/webhooks/__tests__/stripe-route.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `app/api/webhooks/stripe/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { sendEmail, logEmail, EMME_CONNOR_FROM } from '@/lib/email'
import { generateRegistryThankYouEmail } from '@/lib/email-templates'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })

  const raw = await request.text()
  const sig = request.headers.get('stripe-signature') ?? ''

  let event
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as {
      payment_intent: string | null
      amount_total: number | null
      customer_details: { email: string | null } | null
      metadata: Record<string, string> | null
    }
    const paymentIntentId = typeof s.payment_intent === 'string' ? s.payment_intent : null
    const registryItemId = s.metadata?.registryItemId ?? null
    if (paymentIntentId && registryItemId) {
      const already = await prisma.contribution.findUnique({ where: { stripePaymentIntentId: paymentIntentId } })
      if (!already) {
        const amount = (s.amount_total ?? 0) / 100
        const name = s.metadata?.contributorName ?? 'A friend'
        const email = s.customer_details?.email ?? ''
        try {
          await prisma.contribution.create({
            data: {
              registryItemId,
              contributorName: name,
              contributorEmail: email,
              amount,
              message: s.metadata?.contributorMessage || null,
              stripePaymentIntentId: paymentIntentId,
              paymentStatus: 'paid',
              thankYouSent: true,
              thankYouSentAt: new Date(),
            },
          })
          await prisma.registryItem.update({ where: { id: registryItemId }, data: { amountRaised: { increment: amount } } })

          if (email) {
            const item = await prisma.registryItem.findUnique({ where: { id: registryItemId } })
            const tmpl = generateRegistryThankYouEmail({ name, tierTitle: item?.title ?? 'your gift', amount })
            const res = await sendEmail({ to: email, ...tmpl }, { from: EMME_CONNOR_FROM })
            await logEmail({
              emailType: 'registry_thank_you', recipientEmail: email, subject: tmpl.subject,
              status: res.success ? 'sent' : 'failed', resendMessageId: res.success ? res.messageId : null,
            })
          }
        } catch (err) {
          // Do not fail the webhook: log and 200 so Stripe does not hammer retries.
          console.error('Registry webhook processing failed:', err)
        }
      }
    }
  }

  return NextResponse.json({ received: true })
}
```

Note: `thankYouSent` is set at creation because the receipt is sent inline. If the email send fails, the row still records the gift; the failure is in `EmailLog` for follow-up.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/webhooks/__tests__/stripe-route.test.ts`
Expected: PASS (all three cases).

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/stripe/route.ts app/api/webhooks/__tests__/stripe-route.test.ts
git commit -m "feat(registry): stripe webhook records contributions idempotently + sends receipt"
```

---

### Task 8: Public registry page

**Files:**
- Create: `app/(public)/registry/page.tsx`

- [ ] **Step 1: Implement the page** — `app/(public)/registry/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'

interface Tier {
  id: string
  title: string
  description: string | null
  imageUrl: string | null
  category: string
  targetAmount: number
  amountRaised: number
}

const isGoal = (c: string) => c === 'flights' || c === 'accommodation'
const isVariable = (c: string) => c === 'flights'

export default function RegistryPage() {
  const [tiers, setTiers] = useState<Tier[]>([])
  const [active, setActive] = useState<Tier | null>(null)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/registry').then((r) => r.json()).then((d) => setTiers(d.items || []))
  }, [])

  const open = (t: Tier) => { setActive(t); setName(''); setMessage(''); setAmount(''); setError('') }

  const gift = async () => {
    if (!active) return
    setError(''); setBusy(true)
    try {
      const res = await fetch('/api/registry/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registryItemId: active.id,
          name,
          message: message || undefined,
          amount: isVariable(active.category) ? Number(amount) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setBusy(false); return }
      window.location.href = data.url
    } catch {
      setError('Something went wrong — please try again.'); setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFDF7] py-16 px-6">
      <div className="max-w-5xl mx-auto text-center">
        <h1 className="text-4xl font-serif text-[#00330a] mb-3">Honeymoon Fund</h1>
        <p className="text-gray-700 max-w-2xl mx-auto mb-2">
          Emme & Connor are honeymooning in Ireland. If you’d like to help them celebrate,
          a gift toward the trip would mean the world.
        </p>
        <p className="text-sm text-gray-500 mb-12">These are gifts toward the honeymoon, not tax-deductible donations.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
          {tiers.map((t) => {
            const pct = t.targetAmount > 0 ? Math.min(100, Math.round((t.amountRaised / t.targetAmount) * 100)) : 0
            return (
              <div key={t.id} className="bg-white border border-[#D4AF37]/40 rounded-lg p-6 flex flex-col shadow-sm">
                {t.imageUrl && <img src={t.imageUrl} alt="" className="w-full h-40 object-cover rounded-md mb-4" />}
                <h3 className="text-xl font-serif text-[#00330a]">{t.title}</h3>
                {t.description && <p className="text-sm text-gray-600 mt-1 flex-1">{t.description}</p>}
                <div className="mt-4">
                  {isVariable(t.category)
                    ? <p className="text-[#00330a] font-semibold">Choose an amount</p>
                    : <p className="text-[#00330a] font-semibold">${t.targetAmount.toLocaleString('en-US')}</p>}
                  {isGoal(t.category) && (
                    <div className="mt-2">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#00330a]" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        ${t.amountRaised.toLocaleString('en-US')} of ${t.targetAmount.toLocaleString('en-US')} raised
                      </p>
                    </div>
                  )}
                </div>
                <button onClick={() => open(t)}
                  className="mt-5 bg-[#00330a] text-white py-2 rounded-md hover:bg-[#004d0f] transition-colors">
                  Gift this
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {active && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-serif text-[#00330a]">{active.title}</h3>
              <button onClick={() => setActive(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <label className="block text-sm text-gray-700 mb-1">Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-[#00330a]" />
            {isVariable(active.category) && (
              <>
                <label className="block text-sm text-gray-700 mb-1">Amount (USD)</label>
                <input type="number" min={5} value={amount} onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-[#00330a]" />
              </>
            )}
            <label className="block text-sm text-gray-700 mb-1">Message to the couple (optional)</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-[#00330a]" />
            {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
            <button disabled={busy || !name.trim()} onClick={gift}
              className="w-full bg-[#00330a] text-white py-2 rounded-md hover:bg-[#004d0f] transition-colors disabled:opacity-50">
              {busy ? 'Redirecting…' : 'Continue to payment'}
            </button>
            <p className="text-xs text-gray-400 mt-3 text-center">Secure payment via Stripe.</p>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit 2>&1 | grep -i "registry/page.tsx" || echo clean`
Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/registry/page.tsx"
git commit -m "feat(registry): public gift page with tiers, progress bars, and modal"
```

---

### Task 9: Post-payment thank-you page

**Files:**
- Create: `app/(public)/registry/thank-you/page.tsx`

- [ ] **Step 1: Implement** — `app/(public)/registry/thank-you/page.tsx`:

```tsx
import Link from 'next/link'

export default function RegistryThankYouPage() {
  return (
    <div className="min-h-screen bg-[#FFFDF7] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-serif text-[#00330a] mb-4">Thank you!</h1>
        <p className="text-gray-700 mb-2">
          Your gift is on its way to Emme & Connor — thank you for helping them celebrate their honeymoon in Ireland.
        </p>
        <p className="text-gray-500 text-sm mb-8">A receipt is headed to your inbox.</p>
        <Link href="/" className="inline-block bg-[#00330a] text-white px-6 py-2 rounded-md hover:bg-[#004d0f] transition-colors">
          Back to the wedding site
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(public)/registry/thank-you/page.tsx"
git commit -m "feat(registry): post-payment thank-you page"
```

---

### Task 10: Admin report API

**Files:**
- Create: `app/api/admin/registry/route.ts`
- Test: `app/api/admin/registry/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test** — `app/api/admin/registry/__tests__/route.test.ts`:

```typescript
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: { contribution: { findMany: jest.fn() }, registryItem: { findMany: jest.fn() } },
}))

import { GET } from '../route'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
const mockSession = getServerSession as jest.Mock
const mockPrisma = prisma as jest.Mocked<any>

beforeEach(() => { jest.clearAllMocks(); mockSession.mockResolvedValue({ user: { role: 'admin' } }) })

it('401 when not admin', async () => {
  mockSession.mockResolvedValue(null)
  const res: any = await GET({} as any)
  expect(res.status).toBe(401)
})

it('returns contributions + per-tier totals', async () => {
  mockPrisma.registryItem.findMany.mockResolvedValue([
    { id: 'a', title: 'Buy us Dinner', targetAmount: 100, amountRaised: 200, sortOrder: 1, category: 'dining' },
  ])
  mockPrisma.contribution.findMany.mockResolvedValue([
    { id: 'c1', contributorName: 'Sue', contributorEmail: 's@x.com', amount: 100, message: 'Yay', paymentStatus: 'paid', thankYouSent: true, createdAt: new Date('2026-09-01'), registryItem: { title: 'Buy us Dinner' } },
  ])
  const res: any = await GET({} as any)
  expect(res.body.contributions[0]).toMatchObject({ contributorName: 'Sue', tierTitle: 'Buy us Dinner', amount: 100 })
  expect(res.body.tiers[0]).toMatchObject({ title: 'Buy us Dinner', amountRaised: 200 })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/admin/registry/__tests__/route.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `app/api/admin/registry/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [rows, tiers] = await Promise.all([
    prisma.contribution.findMany({ orderBy: { createdAt: 'desc' }, include: { registryItem: { select: { title: true } } } }),
    prisma.registryItem.findMany({ orderBy: { sortOrder: 'asc' } }),
  ])

  const contributions = rows.map((c) => ({
    id: c.id,
    contributorName: c.contributorName,
    contributorEmail: c.contributorEmail,
    tierTitle: c.registryItem?.title ?? '—',
    amount: Number(c.amount),
    message: c.message,
    paymentStatus: c.paymentStatus,
    thankYouSent: c.thankYouSent,
    createdAt: c.createdAt,
  }))
  const tierSummary = tiers.map((t) => ({
    id: t.id, title: t.title, category: t.category, sortOrder: t.sortOrder, isActive: t.isActive,
    targetAmount: Number(t.targetAmount), amountRaised: Number(t.amountRaised),
  }))

  return NextResponse.json({ contributions, tiers: tierSummary })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/admin/registry/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/registry/route.ts app/api/admin/registry/__tests__/route.test.ts
git commit -m "feat(registry): admin report API (contributions + tier totals)"
```

---

### Task 11: Admin CSV export + tier edit

**Files:**
- Create: `app/api/admin/registry/export/route.ts`, `app/api/admin/registry/[id]/route.ts`
- Test: `app/api/admin/registry/__tests__/export-route.test.ts`

- [ ] **Step 1: Write the failing test** — `app/api/admin/registry/__tests__/export-route.test.ts`:

```typescript
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class { constructor(public body: any, public init: any) {} },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { contribution: { findMany: jest.fn() } } }))

import { GET } from '../export/route'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
const mockSession = getServerSession as jest.Mock
const mockPrisma = prisma as jest.Mocked<any>

beforeEach(() => { jest.clearAllMocks(); mockSession.mockResolvedValue({ user: { role: 'admin' } }) })

it('emits CSV with a header and one row per contribution', async () => {
  mockPrisma.contribution.findMany.mockResolvedValue([
    { contributorName: 'Sue', contributorEmail: 's@x.com', amount: 100, message: 'Yay', thankYouSent: true, createdAt: new Date('2026-09-01T00:00:00Z'), registryItem: { title: 'Buy us Dinner' } },
  ])
  const res: any = await GET({} as any)
  const csv: string = res.body
  expect(csv.split('\n')[0]).toContain('Name')
  expect(csv).toContain('Buy us Dinner')
  expect(csv).toContain('Sue')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/admin/registry/__tests__/export-route.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement export** — `app/api/admin/registry/export/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function esc(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const rows = await prisma.contribution.findMany({
    orderBy: { createdAt: 'desc' },
    include: { registryItem: { select: { title: true } } },
  })
  const header = ['Name', 'Email', 'Gift', 'Amount', 'Message', 'Thank-you sent', 'Date']
  const lines = [header.join(',')]
  for (const c of rows) {
    lines.push([
      esc(c.contributorName), esc(c.contributorEmail), esc(c.registryItem?.title ?? '—'),
      Number(c.amount).toFixed(2), esc(c.message ?? ''), c.thankYouSent ? 'Yes' : 'No',
      new Date(c.createdAt).toLocaleDateString('en-US'),
    ].join(','))
  }
  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="registry-contributions.csv"` },
  })
}
```

- [ ] **Step 4: Implement tier edit** — `app/api/admin/registry/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json()
  const data: Record<string, unknown> = {}
  if (typeof body.title === 'string') data.title = body.title
  if (typeof body.description === 'string') data.description = body.description
  if (body.targetAmount != null && body.targetAmount !== '') data.targetAmount = Number(body.targetAmount)
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive
  if (body.sortOrder != null && body.sortOrder !== '') data.sortOrder = parseInt(body.sortOrder)
  if (typeof body.imageUrl === 'string') data.imageUrl = body.imageUrl || null

  const updated = await prisma.registryItem.update({ where: { id }, data })
  return NextResponse.json({ success: true, item: { ...updated, targetAmount: Number(updated.targetAmount), amountRaised: Number(updated.amountRaised) } })
}
```

- [ ] **Step 5: Run tests + type-check**

Run: `npx jest app/api/admin/registry && npx tsc --noEmit 2>&1 | grep -i "admin/registry" || echo clean`
Expected: export test PASS; `clean`.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/registry/export/route.ts "app/api/admin/registry/[id]/route.ts" app/api/admin/registry/__tests__/export-route.test.ts
git commit -m "feat(registry): admin CSV export + tier edit"
```

---

### Task 12: Admin registry page

**Files:**
- Create: `app/admin/registry/page.tsx`

- [ ] **Step 1: Implement** — `app/admin/registry/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'

interface Contribution {
  id: string; contributorName: string; contributorEmail: string; tierTitle: string
  amount: number; message: string | null; paymentStatus: string | null; thankYouSent: boolean; createdAt: string
}
interface TierSummary {
  id: string; title: string; targetAmount: number; amountRaised: number; isActive: boolean
}

export default function AdminRegistryPage() {
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [tiers, setTiers] = useState<TierSummary[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => fetch('/api/admin/registry').then((r) => r.json()).then((d) => {
    setContributions(d.contributions || []); setTiers(d.tiers || []); setLoading(false)
  })
  useEffect(() => { load() }, [])

  const total = contributions.reduce((s, c) => s + c.amount, 0)

  if (loading) return <div className="py-12 text-center text-gray-600">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Registry & Gifts</h1>
        <a href="/api/admin/registry/export" className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">Download CSV</a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-900">${total.toLocaleString('en-US')}</div>
          <div className="text-green-800 text-sm">Total raised</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-900">{contributions.length}</div>
          <div className="text-blue-800 text-sm">Gifts</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-3">By tier</h3>
        <div className="space-y-2">
          {tiers.map((t) => (
            <div key={t.id} className="flex justify-between text-sm border-b border-gray-100 py-2">
              <span>{t.title}{!t.isActive && <span className="text-gray-400"> (inactive)</span>}</span>
              <span className="text-gray-700">${t.amountRaised.toLocaleString('en-US')} raised · target ${t.targetAmount.toLocaleString('en-US')}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-lg font-semibold">Contributions</h3></div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Gift', 'Amount', 'Message', 'Thank-you', 'Date'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contributions.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="font-medium text-gray-900">{c.contributorName}</div>
                    <div className="text-gray-500">{c.contributorEmail}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{c.tierTitle}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${c.amount.toLocaleString('en-US')}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{c.message || '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{c.thankYouSent ? '✅' : '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(c.createdAt).toLocaleDateString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {contributions.length === 0 && <div className="text-center py-12 text-gray-500">No gifts yet.</div>}
        </div>
      </div>
    </div>
  )
}
```

(The dashboard "Registry & Gifts" tile already links to `/admin/registry`, so it now resolves.)

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit 2>&1 | grep -i "admin/registry/page.tsx" || echo clean`
Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add app/admin/registry/page.tsx
git commit -m "feat(registry): admin report page (totals, per-tier, contributions, CSV)"
```

---

### Task 13: Full verification (tests, build, Stripe test-mode smoke)

- [ ] **Step 1: Full test suite**

Run: `npx jest`
Expected: all green (new registry tests + existing).

- [ ] **Step 2: Production build**

Run: `npx next build 2>&1 | grep -iE "Compiled successfully|Failed to compile"`
Expected: `Compiled successfully`.

- [ ] **Step 3: Stripe test-mode end-to-end** (requires `STRIPE_SECRET_KEY` test key in `.env.local` and the Stripe CLI, `stripe login` done):
  - Terminal A: `npm run dev`
  - Terminal B: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` — copy the `whsec_…` it prints into `.env.local` as `STRIPE_WEBHOOK_SECRET`, then restart dev.
  - Open `http://localhost:3000/registry`, gift **Buy us Dinner** with test card `4242 4242 4242 4242` (any future expiry/CVC), then gift the **Flight** with a custom amount.
  - Confirm: redirected to `/registry/thank-you`; the webhook fires (Terminal B shows `checkout.session.completed`); `/admin/registry` shows both gifts with the right amounts; the Dinner and Flight `amountRaised`/progress bars moved; each row shows thank-you ✅.

- [ ] **Step 4: Final commit (if any smoke fixes)**

```bash
git add -A
git commit -m "chore(registry): verification pass"
```

---

## Self-review notes

- **Spec coverage:** tiers seeded (T3); public page + progress bars on goal items + variable Flight + message (T8); Stripe Checkout (T5); webhook records/increments/receipts idempotently (T7); receipt from "Emme & Connor" via existing Resend sender (T6); admin report + per-tier totals + CSV + tier edit (T10–T12); dashboard tile now resolves (T12); amounts admin-only (public API/page never expose names↔amounts); gifts-not-tax-deductible copy (T6, T8); Stripe test mode (T13). No schema migration (models exist).
- **Idempotency & security:** webhook is the only writer of `Contribution`, verifies the Stripe signature (T7), and guards duplicates via `findUnique` on the unique `stripePaymentIntentId`. The checkout route never marks anything paid.
- **Type consistency:** `getStripe()`, `resolveChargeCents`, `tierType`/`isVariable`, `generateRegistryThankYouEmail({name,tierTitle,amount})`, and `EMME_CONNOR_FROM` are used with identical signatures across tasks.
- **Deferred (per spec):** recurring gifts, refunds UI (Stripe dashboard), public donor wall, multi-currency, editing email copy from the UI.
