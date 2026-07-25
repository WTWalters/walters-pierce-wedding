# Preferred Name for Email Greetings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Nicolle set a per-guest "Preferred name (emails)" (e.g. "Grandma") that drives the greeting in every guest-facing email, and stop the registry thank-you from greeting people by their full typed name ("Eleanor Cordi" → "Eleanor").

**Architecture:** One nullable `Guest.preferredName` column, one new pure module (`lib/names.ts`) with `greetingName()` and `shortenTypedName()`, and every greeting call site routed through it — the five gated emails, the save-the-date, and the registry thank-you (which looks the giver up by email, falling back to the shortening rule). Nicolle's internal gift heads-up deliberately keeps the giver's real typed name.

**Tech Stack:** Next.js 15 App Router, Prisma/PostgreSQL, Jest (babel-jest; mocks `next/server` + `next-auth` + `@/lib/prisma` + `@/lib/email`). Run tests/build/prisma under Node 22 (`export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22` — Node 16 crashes Prisma 6).

**Spec:** `docs/superpowers/specs/2026-07-25-preferred-name-design.md`

---

## File Structure

- Create `lib/names.ts` — the two pure greeting helpers. Own module because both server routes and the Stripe webhook consume it.
- Create `lib/__tests__/names.test.ts` — helper tests.
- Modify `prisma/schema.prisma` + create `prisma/migrations/20260725000000_add_guest_preferred_name/migration.sql`.
- Modify `app/admin/guests/page.tsx` — `Guest` interface field + Edit-modal input.
- Modify `app/api/admin/guests/[id]/route.ts` — persist `preferredName`.
- Modify `app/api/admin/rsvps/send/route.ts` — five greetings via `greetingName`.
- Modify `app/api/admin/rsvps/__tests__/send-templates.test.ts` — preferred-name assertion.
- Modify `app/api/admin/save-the-date/send/route.ts` — greeting + `select`.
- Modify `app/api/webhooks/stripe/route.ts` — guest lookup + resolved greeting.
- Modify `app/api/webhooks/__tests__/stripe-route.test.ts` — matched/unmatched paths.

---

## Task 1: Pure helpers — `lib/names.ts`

**Files:**
- Create: `lib/names.ts`
- Test: `lib/__tests__/names.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/names.test.ts`:

```ts
import { greetingName, shortenTypedName } from '@/lib/names'

describe('greetingName', () => {
  it('prefers the preferred name when set', () => {
    expect(greetingName({ preferredName: 'Grandma', firstName: 'Muriel' })).toBe('Grandma')
  })
  it('falls back to the first name when unset, null, or blank', () => {
    expect(greetingName({ firstName: 'Muriel' })).toBe('Muriel')
    expect(greetingName({ preferredName: null, firstName: 'Muriel' })).toBe('Muriel')
    expect(greetingName({ preferredName: '   ', firstName: 'Muriel' })).toBe('Muriel')
  })
  it('trims surrounding whitespace', () => {
    expect(greetingName({ preferredName: '  Grandma  ', firstName: 'Muriel' })).toBe('Grandma')
    expect(greetingName({ firstName: '  Muriel  ' })).toBe('Muriel')
  })
})

describe('shortenTypedName', () => {
  it("keeps each person's first word (Nicolle's real examples)", () => {
    expect(shortenTypedName('Eleanor Cordi')).toBe('Eleanor')
    expect(shortenTypedName('Morgan and Nathan pierce')).toBe('Morgan and Nathan')
    expect(shortenTypedName('Jill and Jose')).toBe('Jill and Jose')
    expect(shortenTypedName('Dad')).toBe('Dad')
  })
  it('preserves mixed connectors in their original order', () => {
    expect(shortenTypedName('Jill & Jose and Bo Smith')).toBe('Jill & Jose and Bo')
    expect(shortenTypedName('Ann + Bob Jones')).toBe('Ann + Bob')
  })
  it('matches the "and" connector case-insensitively and normalizes spacing', () => {
    expect(shortenTypedName('Morgan  AND  Nathan pierce')).toBe('Morgan and Nathan')
  })
  it('never turns a non-empty name into nothing, and handles blank input', () => {
    expect(shortenTypedName('   Dad   ')).toBe('Dad')
    expect(shortenTypedName('')).toBe('')
    expect(shortenTypedName('   ')).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nvm use 22 && npx jest lib/__tests__/names.test.ts`
Expected: FAIL — cannot find module `@/lib/names`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/names.ts`:

```ts
// How a guest is addressed in email. Nicolle sets `preferredName` per guest in Guest
// Management ("Grandma"); everything guest-facing greets through greetingName so the
// override applies everywhere at once.
export function greetingName(guest: { preferredName?: string | null; firstName: string }): string {
  const preferred = (guest.preferredName ?? '').trim()
  return preferred || (guest.firstName ?? '').trim()
}

// Connectors that join two people in one typed name. Kept as a capture group so a
// split retains them and mixed connectors survive in their original order.
const CONNECTOR_SPLIT = /\s+(and|&|\+)\s+/i

// Shortens a name a giver typed at Stripe checkout by keeping each person's FIRST
// word: "Eleanor Cordi" -> "Eleanor", "Morgan and Nathan pierce" -> "Morgan and
// Nathan", "Jill and Jose" -> "Jill and Jose", "Dad" -> "Dad". Used only when the
// giver can't be matched to a guest record (otherwise greetingName wins).
export function shortenTypedName(typed: string): string {
  const input = (typed ?? '').trim()
  if (!input) return input

  // Capturing split => even indices are name parts, odd indices are the connectors.
  const parts = input.split(CONNECTOR_SPLIT)
  const rebuilt = parts
    .map((part, i) =>
      i % 2 === 1
        ? ` ${part.toLowerCase()} `
        : (part.trim().split(/\s+/)[0] ?? '')
    )
    .join('')
    .trim()

  // Belt and braces: never turn a real name into an empty greeting.
  return rebuilt || input
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `nvm use 22 && npx jest lib/__tests__/names.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/names.ts lib/__tests__/names.test.ts
git commit -m "feat(names): greetingName + shortenTypedName helpers for email greetings"
```

---

## Task 2: Schema — `Guest.preferredName`

**Files:**
- Modify: `prisma/schema.prisma` (model `Guest`)
- Create: `prisma/migrations/20260725000000_add_guest_preferred_name/migration.sql`

- [ ] **Step 1: Add the column to the Guest model**

In `prisma/schema.prisma`, inside `model Guest`, add this line immediately after the `lastName` line:

```prisma
  preferredName       String?    @map("preferred_name")
```

- [ ] **Step 2: Hand-author the migration**

`prisma migrate dev` would demand a full reset here (the dev DB is `db push`-managed and has drift vs. migration history) — **do not run it**. Create the folder and file instead, matching the existing `20260718000000_add_photo_device_id` pattern:

```bash
mkdir -p prisma/migrations/20260725000000_add_guest_preferred_name
cat > prisma/migrations/20260725000000_add_guest_preferred_name/migration.sql <<'SQL'
-- AlterTable
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "preferred_name" TEXT;
SQL
```

- [ ] **Step 3: Regenerate the Prisma client and verify**

Run:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22
npx prisma generate 2>&1 | tail -3
grep -n "preferred_name" prisma/schema.prisma
```
Expected: `generate` succeeds; the `preferred_name` mapping is present in the schema.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260725000000_add_guest_preferred_name
git commit -m "feat(guests): add Guest.preferredName column for email greetings"
```

---

## Task 3: Guest Management — the "Preferred name (emails)" field

**Files:**
- Modify: `app/admin/guests/page.tsx`
- Modify: `app/api/admin/guests/[id]/route.ts`

> Client page verified by build; the greeting behavior it feeds is covered by Tasks 4–6.

- [ ] **Step 1: Add the field to the `Guest` interface**

In `app/admin/guests/page.tsx`, the `Guest` interface contains a `lastName: string` line. Add `preferredName` immediately after it:

```ts
  lastName: string
  preferredName?: string | null
```

- [ ] **Step 2: Add the input to the Edit Guest modal**

Still in `app/admin/guests/page.tsx`, find the Email field block inside the Edit modal (it is the block whose label is `Email *`). Immediately **after** that closing `</div>`, insert this new field:

```tsx
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preferred name (emails)</label>
                  <input
                    type="text"
                    value={editingGuest.preferredName ?? ''}
                    onChange={(e) => setEditingGuest({...editingGuest, preferredName: e.target.value})}
                    placeholder="e.g. Grandma — blank uses their first name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
```

- [ ] **Step 3: Persist it in the PUT route**

In `app/api/admin/guests/[id]/route.ts`, the `prisma.guest.update({ data: { ... } })` object contains a `lastName: body.lastName,` line. Add this immediately after it (matching how the route normalizes other optional strings to `null`):

```ts
        preferredName: body.preferredName || null,
```

- [ ] **Step 4: Verify the build compiles**

Run: `nvm use 22 && npx next build 2>&1 | grep -E "Compiled successfully|error"`
Expected: `✓ Compiled successfully`, no errors.

- [ ] **Step 5: Commit**

```bash
git add app/admin/guests/page.tsx "app/api/admin/guests/[id]/route.ts"
git commit -m "feat(guests): 'Preferred name (emails)' field in the Edit Guest modal"
```

---

## Task 4: Gated emails greet via `greetingName`

**Files:**
- Modify: `app/api/admin/rsvps/send/route.ts`
- Test: `app/api/admin/rsvps/__tests__/send-templates.test.ts`

- [ ] **Step 1: Write the failing test**

In `app/api/admin/rsvps/__tests__/send-templates.test.ts`, add this test at the end of the file:

```ts
it('greets with the preferred name when one is set', async () => {
  ;(prisma.guest.findMany as jest.Mock).mockResolvedValue([
    { id: '11111111-1111-4111-8111-111111111111', firstName: 'Muriel', preferredName: 'Grandma',
      email: 'm@x.com', rsvpdCount: 2, reservedSeats: 2 },
  ])
  await POST(req({ guestIds: ['11111111-1111-4111-8111-111111111111'], template: 'rsvp_yes' }))
  const sent = (sendEmail as jest.Mock).mock.calls[0][0]
  expect(sent.html).toContain('Hi Grandma!')
  expect(sent.html).not.toContain('Muriel')
})

it('falls back to the first name when no preferred name is set', async () => {
  await POST(req({ guestIds: ['11111111-1111-4111-8111-111111111111'], template: 'rsvp_no' }))
  const sent = (sendEmail as jest.Mock).mock.calls[0][0]
  expect(sent.html).toContain('Hi Sam,')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nvm use 22 && npx jest app/api/admin/rsvps/__tests__/send-templates.test.ts`
Expected: the `Hi Grandma!` test FAILS (the route still greets with `firstName`, so the email says "Hi Muriel!").

- [ ] **Step 3: Route the greetings through the helper**

In `app/api/admin/rsvps/send/route.ts`:

(a) Add the import next to the other `@/lib` imports:
```ts
import { greetingName } from '@/lib/names'
```

(b) Replace the `GuestRow` type and the `render` switch. The current block is:
```ts
  type GuestRow = { firstName: string; rsvpdCount: number | null; reservedSeats: number | null }
  const render = (g: GuestRow) => {
    switch (template) {
      case 'rsvp_yes': return generateRsvpYesEmail(g.firstName, details, g.rsvpdCount)
      case 'rsvp_no': return generateRsvpNoEmail(g.firstName)
      case 'rsvp_over_count': return generateRsvpOverCountEmail(g.firstName, g.rsvpdCount, g.reservedSeats)
      case 'gracious_regrets': return generateGraciousRegretsEmail(g.firstName)
      case 'venue_details':
      default: return generateVenueDetailsEmail(g.firstName, details)
    }
  }
```
Replace it with:
```ts
  type GuestRow = {
    firstName: string
    preferredName?: string | null
    rsvpdCount: number | null
    reservedSeats: number | null
  }
  const render = (g: GuestRow) => {
    // One resolved greeting for every template — honors the per-guest override.
    const who = greetingName(g)
    switch (template) {
      case 'rsvp_yes': return generateRsvpYesEmail(who, details, g.rsvpdCount)
      case 'rsvp_no': return generateRsvpNoEmail(who)
      case 'rsvp_over_count': return generateRsvpOverCountEmail(who, g.rsvpdCount, g.reservedSeats)
      case 'gracious_regrets': return generateGraciousRegretsEmail(who)
      case 'venue_details':
      default: return generateVenueDetailsEmail(who, details)
    }
  }
```

`findMany` already returns every scalar column, so no query change is needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `nvm use 22 && npx jest app/api/admin/rsvps/__tests__/send-templates.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/rsvps/send/route.ts app/api/admin/rsvps/__tests__/send-templates.test.ts
git commit -m "feat(email): gated emails greet with the guest's preferred name"
```

---

## Task 5: Save-the-date greets by name, not full name

**Files:**
- Modify: `app/api/admin/save-the-date/send/route.ts`

> This route currently greets with `` `${guest.firstName} ${guest.lastName}` `` — the same full-name weirdness Nicolle flagged, in a second place.

- [ ] **Step 1: Add the import**

In `app/api/admin/save-the-date/send/route.ts`, add next to the other `@/lib` imports:

```ts
import { greetingName } from '@/lib/names'
```

- [ ] **Step 2: Select the new column**

The route's `prisma.guest.findMany` has an explicit `select` containing `firstName: true,`. Add `preferredName` immediately after it:

```ts
        firstName: true,
        preferredName: true,
```

- [ ] **Step 3: Use the resolved greeting**

Replace this call:
```ts
        const emailTemplate = generateSaveTheDateEmail(
          `${guest.firstName} ${guest.lastName}`,
          guest.invitationCode!
        )
```
with:
```ts
        const emailTemplate = generateSaveTheDateEmail(
          greetingName(guest),
          guest.invitationCode!
        )
```

Leave the `console.log` / `failures.push` lines alone — those are internal logs and should keep the guest's real full name.

- [ ] **Step 4: Verify the build compiles**

Run: `nvm use 22 && npx next build 2>&1 | grep -E "Compiled successfully|error"`
Expected: `✓ Compiled successfully`, no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/save-the-date/send/route.ts
git commit -m "feat(email): save-the-date greets by preferred/first name instead of full name"
```

---

## Task 6: Registry thank-you resolves the giver's name

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts`
- Test: `app/api/webhooks/__tests__/stripe-route.test.ts`

- [ ] **Step 1: Write the failing test**

In `app/api/webhooks/__tests__/stripe-route.test.ts`:

(a) The prisma mock currently reads:
```ts
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contribution: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    registryItem: { update: jest.fn(), findUnique: jest.fn() },
  },
}))
```
Add a `guest` model to it:
```ts
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contribution: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    registryItem: { update: jest.fn(), findUnique: jest.fn() },
    guest: { findUnique: jest.fn() },
  },
}))
```

(b) The template mock currently reads:
```ts
jest.mock('@/lib/email-templates', () => ({
  generateRegistryThankYouEmail: () => ({ subject: 's', html: 'h', text: 't' }),
  generateGiftNotificationEmail: () => ({ subject: 'gift', html: 'gh', text: 'gt' }),
}))
```
Replace it with one that echoes the name it was handed, so the tests can assert on it:
```ts
jest.mock('@/lib/email-templates', () => ({
  generateRegistryThankYouEmail: ({ name }: { name: string }) =>
    ({ subject: `thanks ${name}`, html: 'h', text: 't' }),
  generateGiftNotificationEmail: ({ name }: { name: string }) =>
    ({ subject: `gift ${name}`, html: 'gh', text: 'gt' }),
}))
```

(c) In the existing `beforeEach`, default the guest lookup to "no match" by adding this line after the `registryItem.findUnique` default:
```ts
  mockPrisma.guest.findUnique.mockResolvedValue(null)
```

(d) Add these two tests at the end of the file:
```ts
it('greets an unmatched giver with their shortened typed name', async () => {
  mockConstructEvent.mockReturnValue(completedEvent)
  mockPrisma.contribution.findUnique.mockResolvedValue(null)
  mockPrisma.contribution.create.mockResolvedValue({ id: 'c1' })
  mockPrisma.contribution.update.mockResolvedValue({})
  mockPrisma.registryItem.update.mockResolvedValue({})

  await POST(req())

  // "Aunt Sue" -> first word of the single name part
  const thankYou = (sendEmail as jest.Mock).mock.calls.find((c) => c[0].subject?.startsWith('thanks'))
  expect(thankYou[0].subject).toBe('thanks Aunt')
  // the coordinator heads-up keeps the REAL typed name
  const notif = (sendEmail as jest.Mock).mock.calls.find((c) => c[0].subject?.startsWith('gift'))
  expect(notif[0].subject).toBe('gift Aunt Sue')
})

it('greets a matched guest with their preferred name', async () => {
  mockConstructEvent.mockReturnValue(completedEvent)
  mockPrisma.contribution.findUnique.mockResolvedValue(null)
  mockPrisma.contribution.create.mockResolvedValue({ id: 'c1' })
  mockPrisma.contribution.update.mockResolvedValue({})
  mockPrisma.registryItem.update.mockResolvedValue({})
  mockPrisma.guest.findUnique.mockResolvedValue({ firstName: 'Muriel', preferredName: 'Grandma' })

  await POST(req())

  expect(mockPrisma.guest.findUnique).toHaveBeenCalledWith({ where: { email: 'sue@example.com' } })
  const thankYou = (sendEmail as jest.Mock).mock.calls.find((c) => c[0].subject?.startsWith('thanks'))
  expect(thankYou[0].subject).toBe('thanks Grandma')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nvm use 22 && npx jest app/api/webhooks/__tests__/stripe-route.test.ts`
Expected: the two new tests FAIL — the route still passes the raw typed name (`thanks Aunt Sue`) and never calls `guest.findUnique`.

- [ ] **Step 3: Resolve the greeting in the webhook**

In `app/api/webhooks/stripe/route.ts`:

(a) Add the import next to the other `@/lib` imports:
```ts
import { greetingName, shortenTypedName } from '@/lib/names'
```

(b) The route already looks up the tier with `const item = await prisma.registryItem.findUnique({ where: { id: registryItemId } })`. Immediately **after** that line, add the greeting resolution:
```ts
          // Greet the giver the way Nicolle asked: a matched guest's preferred name
          // (or first name), else shorten the free text they typed at checkout.
          // Guest.email is unique and stored lowercased by the RSVP intake.
          const guestRecord = email
            ? await prisma.guest.findUnique({ where: { email: email.toLowerCase() } })
            : null
          const greeting = guestRecord ? greetingName(guestRecord) : shortenTypedName(name)
```

(c) In the thank-you send, change the template's `name` from the raw typed value to the resolved greeting. The current call is:
```ts
            const tmpl = generateRegistryThankYouEmail({ name, tierTitle: item?.title ?? 'your gift', amount })
```
Replace it with:
```ts
            const tmpl = generateRegistryThankYouEmail({ name: greeting, tierTitle: item?.title ?? 'your gift', amount })
```

**Leave `generateGiftNotificationEmail({ name, ... })` alone** — Nicolle's heads-up must keep the giver's real typed name.

- [ ] **Step 4: Run test to verify it passes**

Run: `nvm use 22 && npx jest app/api/webhooks/__tests__/stripe-route.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/stripe/route.ts app/api/webhooks/__tests__/stripe-route.test.ts
git commit -m "feat(registry): thank-you greets by preferred name, else the giver's first name"
```

---

## Task 7: Full verification

- [ ] **Step 1: Full test suite**

Run: `nvm use 22 && npx jest 2>&1 | tail -4`
Expected: all suites pass (existing + the new `lib/__tests__/names.test.ts` and the added route tests).

- [ ] **Step 2: Production build**

Run: `nvm use 22 && npx next build 2>&1 | tail -20`
Expected: `✓ Compiled successfully`, no errors.

- [ ] **Step 3: Confirm no new type errors**

The repo has pre-existing `tsc --noEmit` errors and `next.config` sets `ignoreBuildErrors: true`, so compare counts rather than expecting zero:

```bash
nvm use 22
npx tsc --noEmit 2>&1 | grep -c "error TS"    # with changes
git stash && npx tsc --noEmit 2>&1 | grep -c "error TS" && git stash pop   # baseline
```
Expected: the two counts are **equal** (this change adds no new type errors).

---

## Post-deploy note (no code)

On merge + push, Railway runs `prisma migrate deploy`, applying `add_guest_preferred_name`. The field starts **empty for every guest**, so behavior is unchanged until Nicolle/Emme fill it in (Guest Management → Edit → "Preferred name (emails)"). Emails already delivered are frozen — this affects future sends only.

---

## Self-Review

- **Spec coverage:** `preferredName` column + hand-authored migration (Task 2 ✓); `lib/names.ts` with both helpers incl. the capturing-split connector rule and the never-empty guard (Task 1 ✓); Edit-modal field labeled "Preferred name (emails)" + PUT persistence (Task 3 ✓); five gated greetings (Task 4 ✓); save-the-date greeting + `select` (Task 5 ✓); registry thank-you guest lookup with lowercased email + shortening fallback (Task 6 ✓); gift notification keeps the real typed name (Task 6 step 3c, asserted in Task 6 step 1d ✓); grid/CSV/seating untouched (no task modifies them ✓); testing matrix (Tasks 1, 4, 6 ✓). Out-of-scope items (grid display, Add-Guest form, retroactive re-sends, Contribution↔Guest FK) correctly absent.
- **Placeholder scan:** none — every step contains full code or an exact command with expected output.
- **Type consistency:** `greetingName(guest: { preferredName?: string | null; firstName: string })` defined in Task 1 and called in Tasks 4, 5, 6 with objects satisfying that shape (`GuestRow` gains `preferredName?: string | null`; the STD `select` adds `preferredName`; the webhook passes the fetched guest row). `shortenTypedName(typed: string)` defined in Task 1, called in Task 6. `preferredName` is the same property name in the schema (Task 2), the client `Guest` interface (Task 3), the PUT body (Task 3), and every consumer.
