# Unmatched – To Review Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hold unmatched RSVP submissions in a dedicated "To Review" admin tab — hidden from Guest Management and all counts until an admin approves, matches, or deletes them — with one-click confirm/decline emails.

**Architecture:** Unmatched submissions already exist as `Guest` rows with `source='self_rsvp'`. Add a `reviewedAt` timestamp; "awaiting review" = `source='self_rsvp' AND reviewedAt IS NULL`. A single shared where-fragment (`lib/review.ts`) excludes those rows everywhere else (guest list + both stats endpoints). New review API routes handle approve/match; the existing `/api/admin/rsvps/send` endpoint and email templates are reused for the two canned messages.

**Tech Stack:** Next.js 15 App Router, Prisma/PostgreSQL, Zod, Jest (babel-jest; mock `next/server`, `next-auth`, `@/lib/prisma`), Tailwind (green `#00330a`, gold `#D4AF37`).

**Spec:** `docs/superpowers/specs/2026-07-16-rsvp-review-queue-design.md`
**Branch:** `feature/rsvp-review-queue` (worktree under `.worktrees/` if isolating — NOT `.claude/`, jest ignores it).

---

## File Map

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | + `reviewedAt`, `reviewedBy` on `Guest` |
| `lib/review.ts` | shared `AWAITING_REVIEW` / `NOT_AWAITING_REVIEW` Prisma where-fragments |
| `app/api/admin/guests/stats/route.ts` | exclude awaiting-review from ATTENDING / rsvpReceived / notAttending / totalInvited |
| `app/api/admin/stats/route.ts` | exclude awaiting-review from dashboard counts |
| `app/api/admin/guests/route.ts` | exclude awaiting-review from the main guest list |
| `app/api/admin/review/route.ts` | GET queue (awaiting-review rows) + count |
| `app/api/admin/review/[id]/approve/route.ts` | POST approve (set reviewedAt, backfill reservedSeats) |
| `app/api/admin/review/[id]/match/route.ts` | POST match submission → existing invited guest |
| `app/admin/layout.tsx` | add "To Review" nav link + count badge |
| `app/admin/review/page.tsx` | the queue grid + actions + wedding-details editor |
| `app/admin/page.tsx` | repoint any dashboard card from `/admin/rsvps` → `/admin/review` |
| `app/admin/rsvps/page.tsx` | DELETE (retire bucket panel); keep the API routes |

Tests live in `__tests__/` beside each route (repo convention).

---

### Task 1: Migration — reviewedAt / reviewedBy on Guest

**Files:**
- Modify: `prisma/schema.prisma`
- Migration: `prisma/migrations/<timestamp>_guest_reviewed_at/migration.sql`

- [ ] **Step 1: Edit schema.** In `model Guest`, add after `notes`:

```prisma
  reviewedAt         DateTime? @map("reviewed_at")
  reviewedBy         String?   @map("reviewed_by")
```

- [ ] **Step 2: Create the migration SQL manually** (the repo's convention — `migrate dev` needs a TTY; see prior migrations). Create `prisma/migrations/<YYYYMMDDHHMMSS>_guest_reviewed_at/migration.sql` with exactly:

```sql
-- AlterTable
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3);
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "reviewed_by" TEXT;
```

- [ ] **Step 3: Apply to local dev DB + regenerate client**

Run: `npx prisma db push --skip-generate && npx prisma generate`
(Use `db push` to reconcile the local dev DB, which was originally push-created; `migrate deploy` handles prod on push. Both new columns are nullable/idempotent.)
Expected: "Your database is now in sync", client regenerated.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "schema|guest" || echo "no new errors"`
Expected: no new errors (pre-existing unrelated errors OK).

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat(review): add reviewedAt/reviewedBy to Guest for the review queue"
```

---

### Task 2: `lib/review.ts` — shared where-fragments

**Files:**
- Create: `lib/review.ts`
- Test: `lib/__tests__/review.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/__tests__/review.test.ts
import { AWAITING_REVIEW, NOT_AWAITING_REVIEW } from '@/lib/review'

it('AWAITING_REVIEW targets unreviewed self-RSVP rows only', () => {
  expect(AWAITING_REVIEW).toEqual({ source: 'self_rsvp', reviewedAt: null })
})

it('NOT_AWAITING_REVIEW is the negation used to exclude them elsewhere', () => {
  expect(NOT_AWAITING_REVIEW).toEqual({ NOT: { source: 'self_rsvp', reviewedAt: null } })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/__tests__/review.test.ts`
Expected: FAIL — cannot find module `@/lib/review`

- [ ] **Step 3: Implement**

```typescript
// lib/review.ts
import { Prisma } from '@prisma/client'

// A Guest row is "awaiting review" when it's an unmatched self-RSVP that no admin
// has approved or matched yet. Such rows appear ONLY in the To Review queue — never
// in the main guest list or any headcount — until an admin acts on them.
export const AWAITING_REVIEW: Prisma.GuestWhereInput = {
  source: 'self_rsvp',
  reviewedAt: null,
}

// Negation: merge into any where-clause that must exclude the review queue.
export const NOT_AWAITING_REVIEW: Prisma.GuestWhereInput = {
  NOT: { source: 'self_rsvp', reviewedAt: null },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/__tests__/review.test.ts`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add lib/review.ts lib/__tests__/review.test.ts
git commit -m "feat(review): shared where-fragments for the review-queue filter"
```

---

### Task 3: Exclude awaiting-review from guest stats

**Files:**
- Modify: `app/api/admin/guests/stats/route.ts`
- Modify: `app/api/admin/stats/route.ts`
- Test: `app/api/admin/__tests__/stats-exclusion.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/admin/__tests__/stats-exclusion.test.ts
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    guest: { findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
  },
}))

import { getServerSession } from 'next-auth'
import { GET as guestStats } from '../guests/stats/route'
import { GET as dashStats } from '../stats/route'
import { prisma } from '@/lib/prisma'

const req = () => ({ url: 'http://x' }) as never
const EXCLUDE = { NOT: { source: 'self_rsvp', reviewedAt: null } }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
  ;(prisma.guest.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.guest.count as jest.Mock).mockResolvedValue(0)
  ;(prisma.guest.aggregate as jest.Mock).mockResolvedValue({ _sum: { reservedSeats: 0 } })
})

it('guests/stats excludes awaiting-review from attending and notAttending', async () => {
  await guestStats(req())
  expect(prisma.guest.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { attending: true, ...EXCLUDE } })
  )
  expect(prisma.guest.count).toHaveBeenCalledWith({ where: { attending: false, ...EXCLUDE } })
})

it('dashboard stats excludes awaiting-review from all counts', async () => {
  await dashStats(req())
  const calls = (prisma.guest.count as jest.Mock).mock.calls.map((c) => c[0])
  // total, attending, notAttending, responses — every count carries the exclusion
  expect(calls).toContainEqual({ where: EXCLUDE })
  expect(calls).toContainEqual({ where: { attending: true, ...EXCLUDE } })
  expect(calls).toContainEqual({ where: { attending: false, ...EXCLUDE } })
  expect(calls).toContainEqual({ where: { attending: { not: null }, ...EXCLUDE } })
})

it('guests/stats 401s non-admin', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'guest' } })
  const res = (await guestStats(req())) as { status: number }
  expect(res.status).toBe(401)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/admin/__tests__/stats-exclusion.test.ts`
Expected: FAIL (where clauses don't include the exclusion yet)

- [ ] **Step 3: Edit `app/api/admin/guests/stats/route.ts`**

Add import after the prisma import:
```typescript
import { NOT_AWAITING_REVIEW } from '@/lib/review'
```
Replace the `Promise.all` queries with:
```typescript
    const [attendingParties, notAttending, seatSum] = await Promise.all([
      prisma.guest.findMany({
        where: { attending: true, ...NOT_AWAITING_REVIEW },
        select: { rsvpdCount: true, partySize: true },
      }),
      prisma.guest.count({ where: { attending: false, ...NOT_AWAITING_REVIEW } }),
      prisma.guest.aggregate({ _sum: { reservedSeats: true }, where: NOT_AWAITING_REVIEW }),
    ])
```

- [ ] **Step 4: Edit `app/api/admin/stats/route.ts`**

Add import after the prisma import:
```typescript
import { NOT_AWAITING_REVIEW } from '@/lib/review'
```
Replace the `Promise.all` queries with:
```typescript
    const [totalGuests, attendingCount, notAttendingCount, rsvpResponses] = await Promise.all([
      prisma.guest.count({ where: NOT_AWAITING_REVIEW }),
      prisma.guest.count({ where: { attending: true, ...NOT_AWAITING_REVIEW } }),
      prisma.guest.count({ where: { attending: false, ...NOT_AWAITING_REVIEW } }),
      prisma.guest.count({ where: { attending: { not: null }, ...NOT_AWAITING_REVIEW } }),
    ])
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest app/api/admin/__tests__/stats-exclusion.test.ts`
Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/guests/stats/route.ts app/api/admin/stats/route.ts app/api/admin/__tests__/stats-exclusion.test.ts
git commit -m "fix(review): exclude awaiting-review submissions from all admin counts"
```

---

### Task 4: Exclude awaiting-review from the guest list

**Files:**
- Modify: `app/api/admin/guests/route.ts` (GET only)
- Test: `app/api/admin/guests/__tests__/list-exclusion.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/admin/guests/__tests__/list-exclusion.test.ts
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { guest: { findMany: jest.fn() } } }))

import { getServerSession } from 'next-auth'
import { GET } from '../route'
import { prisma } from '@/lib/prisma'

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
  ;(prisma.guest.findMany as jest.Mock).mockResolvedValue([])
})

it('list excludes awaiting-review submissions', async () => {
  await GET({ url: 'http://x' } as never)
  expect(prisma.guest.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { NOT: { source: 'self_rsvp', reviewedAt: null } } })
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/admin/guests/__tests__/list-exclusion.test.ts`
Expected: FAIL — findMany currently called without `where`

- [ ] **Step 3: Edit `app/api/admin/guests/route.ts`** — GET handler only

Add import:
```typescript
import { NOT_AWAITING_REVIEW } from '@/lib/review'
```
Add `where` to the GET's `findMany` (which currently has only `include`/`orderBy`):
```typescript
    const guests = await prisma.guest.findMany({
      where: NOT_AWAITING_REVIEW,
      include: { plusOnes: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/admin/guests/__tests__/list-exclusion.test.ts`
Expected: 1 passed. Then full suite tail — no regressions.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/guests/route.ts app/api/admin/guests/__tests__/list-exclusion.test.ts
git commit -m "fix(review): hide awaiting-review submissions from the guest list"
```

---

### Task 5: GET /api/admin/review — the queue

**Files:**
- Create: `app/api/admin/review/route.ts`
- Test: `app/api/admin/review/__tests__/review-list.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/admin/review/__tests__/review-list.test.ts
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { guest: { findMany: jest.fn() } } }))

import { getServerSession } from 'next-auth'
import { GET } from '../route'
import { prisma } from '@/lib/prisma'

const req = () => ({ url: 'http://x' }) as never

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
})

it('returns awaiting-review submissions with a count', async () => {
  ;(prisma.guest.findMany as jest.Mock).mockResolvedValue([{ id: 'a' }, { id: 'b' }])
  const res = (await GET(req())) as { body: { submissions: unknown[]; count: number } }
  expect(prisma.guest.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { source: 'self_rsvp', reviewedAt: null } })
  )
  expect(res.body.count).toBe(2)
  expect(res.body.submissions).toHaveLength(2)
})

it('401s non-admin', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  const res = (await GET(req())) as { status: number }
  expect(res.status).toBe(401)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/admin/review/__tests__/review-list.test.ts`
Expected: FAIL — cannot find `../route`

- [ ] **Step 3: Implement**

```typescript
// app/api/admin/review/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AWAITING_REVIEW } from '@/lib/review'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const submissions = await prisma.guest.findMany({
      where: AWAITING_REVIEW,
      orderBy: { rsvpReceivedAt: 'desc' },
      include: { emailLogs: { orderBy: { createdAt: 'desc' }, take: 1 } },
    })
    return NextResponse.json({ submissions, count: submissions.length })
  } catch (error) {
    console.error('Error fetching review queue:', error)
    return NextResponse.json({ error: 'Failed to fetch review queue' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/admin/review/__tests__/review-list.test.ts`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/review/route.ts app/api/admin/review/__tests__/review-list.test.ts
git commit -m "feat(review): GET /api/admin/review queue endpoint"
```

---

### Task 6: POST /api/admin/review/[id]/approve

**Files:**
- Create: `app/api/admin/review/[id]/approve/route.ts`
- Test: `app/api/admin/review/__tests__/approve.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/admin/review/__tests__/approve.test.ts
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { guest: { findFirst: jest.fn(), update: jest.fn() } } }))

import { getServerSession } from 'next-auth'
import { POST } from '../[id]/approve/route'
import { prisma } from '@/lib/prisma'

const ctx = { params: Promise.resolve({ id: 'g1' }) }
const req = () => ({}) as never

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin', email: 'nicolle@x.com' } })
})

it('approves: sets reviewedAt/reviewedBy and backfills reservedSeats from rsvpdCount', async () => {
  ;(prisma.guest.findFirst as jest.Mock).mockResolvedValue({ id: 'g1', reservedSeats: null, rsvpdCount: 3 })
  ;(prisma.guest.update as jest.Mock).mockResolvedValue({})
  const res = (await POST(req(), ctx)) as { status: number; body: Record<string, unknown> }
  expect(res.status).toBe(200)
  const call = (prisma.guest.update as jest.Mock).mock.calls[0][0]
  expect(call.where).toEqual({ id: 'g1' })
  expect(call.data.reviewedAt).toBeInstanceOf(Date)
  expect(call.data.reviewedBy).toBe('nicolle@x.com')
  expect(call.data.reservedSeats).toBe(3)
})

it('does not overwrite an existing reservedSeats', async () => {
  ;(prisma.guest.findFirst as jest.Mock).mockResolvedValue({ id: 'g1', reservedSeats: 2, rsvpdCount: 5 })
  ;(prisma.guest.update as jest.Mock).mockResolvedValue({})
  await POST(req(), ctx)
  expect((prisma.guest.update as jest.Mock).mock.calls[0][0].data.reservedSeats).toBe(2)
})

it('404s if the id is not an awaiting-review submission', async () => {
  ;(prisma.guest.findFirst as jest.Mock).mockResolvedValue(null)
  const res = (await POST(req(), ctx)) as { status: number }
  expect(res.status).toBe(404)
  expect(prisma.guest.update).not.toHaveBeenCalled()
})

it('401s non-admin', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'guest' } })
  const res = (await POST(req(), ctx)) as { status: number }
  expect(res.status).toBe(401)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/admin/review/__tests__/approve.test.ts`
Expected: FAIL — cannot find `../[id]/approve/route`

- [ ] **Step 3: Implement**

```typescript
// app/api/admin/review/[id]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AWAITING_REVIEW } from '@/lib/review'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const submission = await prisma.guest.findFirst({ where: { id, ...AWAITING_REVIEW } })
    if (!submission) {
      return NextResponse.json({ error: 'Not a pending submission' }, { status: 404 })
    }
    await prisma.guest.update({
      where: { id },
      data: {
        reviewedAt: new Date(),
        reviewedBy: session.user.email ?? null,
        // Backfill the seat allocation so the approved party is reflected in
        // Total Invited (self_rsvp rows arrive with reservedSeats = null).
        reservedSeats: submission.reservedSeats ?? submission.rsvpdCount ?? null,
      },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error approving submission:', error)
    return NextResponse.json({ error: 'Failed to approve' }, { status: 500 })
  }
}
```

Note: `{ id, ...AWAITING_REVIEW }` spreads to `{ id, source: 'self_rsvp', reviewedAt: null }` — a valid `findFirst` where.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/admin/review/__tests__/approve.test.ts`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add "app/api/admin/review/[id]/approve/" app/api/admin/review/__tests__/approve.test.ts
git commit -m "feat(review): approve endpoint — marks reviewed + backfills reserved seats"
```

---

### Task 7: POST /api/admin/review/[id]/match

**Files:**
- Create: `app/api/admin/review/[id]/match/route.ts`
- Test: `app/api/admin/review/__tests__/match.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/admin/review/__tests__/match.test.ts
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { guest: { findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() } } }))

import { getServerSession } from 'next-auth'
import { POST } from '../[id]/match/route'
import { prisma } from '@/lib/prisma'

const ctx = { params: Promise.resolve({ id: 'sub1' }) }
const req = (json: unknown) => ({ json: async () => json }) as never
const submission = { id: 'sub1', attending: true, rsvpdCount: 2, partySize: 2, dietaryRestrictions: 'veg', songRequest: 'ABBA', rsvpReceivedAt: new Date('2026-09-01'), email: 'guest@x.com', firstName: 'Sam', lastName: 'Smith' }
const target = { id: 'tgt1', source: 'imported', reservedSeats: 4, email: 'official@x.com', firstName: 'Samuel', lastName: 'Smith' }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
})

it('copies RSVP data onto the target, deletes the submission, never touches target identity/email', async () => {
  ;(prisma.guest.findFirst as jest.Mock)
    .mockResolvedValueOnce(submission) // submission lookup
    .mockResolvedValueOnce(target)     // target lookup
  ;(prisma.guest.update as jest.Mock).mockResolvedValue({})
  ;(prisma.guest.delete as jest.Mock).mockResolvedValue({})
  const res = (await POST(req({ targetGuestId: 'tgt1' }), ctx)) as { status: number; body: Record<string, unknown> }
  expect(res.status).toBe(200)
  const upd = (prisma.guest.update as jest.Mock).mock.calls[0][0]
  expect(upd.where).toEqual({ id: 'tgt1' })
  expect(upd.data).toEqual({
    attending: true, rsvpdCount: 2, partySize: 2,
    dietaryRestrictions: 'veg', songRequest: 'ABBA', rsvpReceivedAt: submission.rsvpReceivedAt,
  })
  expect(upd.data.email).toBeUndefined()
  expect(upd.data.firstName).toBeUndefined()
  expect(prisma.guest.delete).toHaveBeenCalledWith({ where: { id: 'sub1' } })
  expect(res.body).toMatchObject({ ok: true, overCap: false })
})

it('flags overCap when submission headcount exceeds target reserved seats', async () => {
  ;(prisma.guest.findFirst as jest.Mock)
    .mockResolvedValueOnce({ ...submission, rsvpdCount: 6 })
    .mockResolvedValueOnce(target)
  ;(prisma.guest.update as jest.Mock).mockResolvedValue({})
  ;(prisma.guest.delete as jest.Mock).mockResolvedValue({})
  const res = (await POST(req({ targetGuestId: 'tgt1' }), ctx)) as { body: Record<string, unknown> }
  expect(res.body).toMatchObject({ ok: true, overCap: true })
})

it('404s when submission is not awaiting review', async () => {
  ;(prisma.guest.findFirst as jest.Mock).mockResolvedValueOnce(null)
  const res = (await POST(req({ targetGuestId: 'tgt1' }), ctx)) as { status: number }
  expect(res.status).toBe(404)
})

it('422s when target is missing or not an official (imported) guest', async () => {
  ;(prisma.guest.findFirst as jest.Mock)
    .mockResolvedValueOnce(submission)
    .mockResolvedValueOnce(null)
  const res = (await POST(req({ targetGuestId: 'tgt1' }), ctx)) as { status: number }
  expect(res.status).toBe(422)
  expect(prisma.guest.delete).not.toHaveBeenCalled()
})

it('400s without a targetGuestId', async () => {
  ;(prisma.guest.findFirst as jest.Mock).mockResolvedValueOnce(submission)
  const res = (await POST(req({}), ctx)) as { status: number }
  expect(res.status).toBe(400)
})

it('401s non-admin', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  const res = (await POST(req({ targetGuestId: 'tgt1' }), ctx)) as { status: number }
  expect(res.status).toBe(401)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/admin/review/__tests__/match.test.ts`
Expected: FAIL — cannot find `../[id]/match/route`

- [ ] **Step 3: Implement**

```typescript
// app/api/admin/review/[id]/match/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AWAITING_REVIEW } from '@/lib/review'

const schema = z.object({ targetGuestId: z.string().uuid() })

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params

    const submission = await prisma.guest.findFirst({ where: { id, ...AWAITING_REVIEW } })
    if (!submission) {
      return NextResponse.json({ error: 'Not a pending submission' }, { status: 404 })
    }

    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Target must be an official (imported) invited guest — never another submission.
    const target = await prisma.guest.findFirst({
      where: { id: parsed.data.targetGuestId, source: 'imported' },
    })
    if (!target) {
      return NextResponse.json({ error: 'Target is not an invited guest' }, { status: 422 })
    }

    const overCap = target.reservedSeats != null && (submission.rsvpdCount ?? 0) > target.reservedSeats

    // Copy the RSVP answer onto the official record. Identity + email + reservedSeats
    // on the target are left untouched (the official record stays authoritative —
    // same invariant as name-matching in lib/rsvp.ts).
    await prisma.guest.update({
      where: { id: target.id },
      data: {
        attending: submission.attending,
        rsvpdCount: submission.rsvpdCount,
        partySize: submission.partySize,
        dietaryRestrictions: submission.dietaryRestrictions,
        songRequest: submission.songRequest,
        rsvpReceivedAt: submission.rsvpReceivedAt,
      },
    })
    await prisma.guest.delete({ where: { id: submission.id } })

    return NextResponse.json({ ok: true, overCap })
  } catch (error) {
    console.error('Error matching submission:', error)
    return NextResponse.json({ error: 'Failed to match' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/admin/review/__tests__/match.test.ts`
Expected: 6 passed. Then full suite tail — no regressions.

- [ ] **Step 5: Commit**

```bash
git add "app/api/admin/review/[id]/match/" app/api/admin/review/__tests__/match.test.ts
git commit -m "feat(review): match endpoint — merge submission into an invited guest"
```

---

### Task 8: Admin nav "To Review" link + count badge

**Files:**
- Modify: `app/admin/layout.tsx`

UI task (verified by build + live smoke). The badge count comes from `GET /api/admin/review`.

- [ ] **Step 1: Add the nav link with a live badge**

In `app/admin/layout.tsx`, add `useState`/`useEffect` imports (already imports `useEffect`; add `useState`):
```typescript
import { useEffect, useState } from 'react'
```
Add the link to `NAV_LINKS`:
```typescript
const NAV_LINKS = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Guest Management', href: '/admin/guests' },
  { label: 'To Review', href: '/admin/review' },
]
```
Inside `AdminLayout`, after the existing hooks, fetch the count:
```typescript
  const [reviewCount, setReviewCount] = useState(0)
  useEffect(() => {
    if (status !== 'authenticated' || session?.user.role !== 'admin') return
    fetch('/api/admin/review')
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => setReviewCount(d.count ?? 0))
      .catch(() => setReviewCount(0))
  }, [status, session, pathname]) // re-fetch on route change so it updates after actions
```
In the `NAV_LINKS.map`, render a badge for the To Review link:
```tsx
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-green-800 text-green-900'
                      : 'border-transparent text-gray-600 hover:text-green-800 hover:border-green-300'
                  }`}
                >
                  {link.label}
                  {link.href === '/admin/review' && reviewCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center rounded-full bg-amber-600 text-white text-xs px-2 py-0.5">
                      {reviewCount}
                    </span>
                  )}
                </Link>
```

- [ ] **Step 2: Build check**

Run: `npx next build 2>&1 | tail -6`
Expected: success (`/admin/review` will 404 at runtime until Task 9 adds the page, but the build compiles).

- [ ] **Step 3: Commit**

```bash
git add app/admin/layout.tsx
git commit -m "feat(review): add To Review nav link with pending-count badge"
```

---

### Task 9: /admin/review page — grid, actions, wedding-details editor

**Files:**
- Create: `app/admin/review/page.tsx`

UI task (verified by build + live smoke in Task 11). Match the Guest Management look (white cards, green `#00330a` headings). Reuses `GET /api/admin/review`, the approve/match routes, `DELETE /api/admin/guests/[id]`, `POST /api/admin/rsvps/send` (templates `venue_details` / `gracious_regrets`), and `GET/PUT /api/admin/rsvps` (wedding details).

- [ ] **Step 1: Implement the page**

```tsx
// app/admin/review/page.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'

type Submission = {
  id: string; firstName: string; lastName: string; email: string
  attending: boolean | null; rsvpdCount: number | null
  dietaryRestrictions: string | null; songRequest: string | null
  rsvpReceivedAt: string | null
  emailLogs: { status: string; emailType: string }[]
}
type InvitedGuest = { id: string; firstName: string; lastName: string; email: string | null; reservedSeats: number | null }

export default function ReviewPage() {
  const [subs, setSubs] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [matchFor, setMatchFor] = useState<Submission | null>(null)
  const [guests, setGuests] = useState<InvitedGuest[]>([])

  const refresh = useCallback(async () => {
    const res = await fetch('/api/admin/review')
    if (res.ok) { setSubs((await res.json()).submissions); setError('') }
    else setError('Failed to load the review queue')
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function approve(s: Submission) {
    setBusyId(s.id)
    try {
      const res = await fetch(`/api/admin/review/${s.id}/approve`, { method: 'POST' })
      if (!res.ok) throw new Error()
      await refresh()
    } catch { setError('Approve failed — try again') } finally { setBusyId(null) }
  }

  async function remove(s: Submission) {
    if (!confirm(`Delete ${s.firstName} ${s.lastName}'s submission? This cannot be undone.`)) return
    setBusyId(s.id)
    try {
      const res = await fetch(`/api/admin/guests/${s.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      await refresh()
    } catch { setError('Delete failed — try again') } finally { setBusyId(null) }
  }

  async function send(s: Submission, template: 'venue_details' | 'gracious_regrets') {
    const label = template === 'venue_details' ? 'the “you’re coming” details' : 'the regrets message'
    if (!confirm(`Send ${label} to ${s.email}?`)) return
    setBusyId(s.id)
    try {
      const res = await fetch('/api/admin/rsvps/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestIds: [s.id], template }),
      })
      if (!res.ok) throw new Error()
      await refresh()
    } catch { setError('Send failed — try again') } finally { setBusyId(null) }
  }

  async function openMatch(s: Submission) {
    setMatchFor(s)
    if (guests.length === 0) {
      const res = await fetch('/api/admin/guests')
      if (res.ok) setGuests((await res.json()).guests)
    }
  }

  async function confirmMatch(targetGuestId: string) {
    if (!matchFor) return
    const s = matchFor
    const target = guests.find((g) => g.id === targetGuestId)
    if (target && target.reservedSeats != null && (s.rsvpdCount ?? 0) > target.reservedSeats) {
      if (!confirm(`Heads up: they RSVP'd ${s.rsvpdCount} but ${target.firstName} has only ${target.reservedSeats} reserved seats. Match anyway?`)) return
    }
    setBusyId(s.id)
    try {
      const res = await fetch(`/api/admin/review/${s.id}/match`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetGuestId }),
      })
      if (!res.ok) throw new Error()
      setMatchFor(null)
      await refresh()
    } catch { setError('Match failed — try again') } finally { setBusyId(null) }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-[#00330a]">Unmatched — To Review</h1>
      <p className="text-sm text-gray-600 mt-1">
        RSVPs that didn’t match the invite list. They’re hidden from Guest Management and the
        counts until you approve or match them. Blocked/uninvited people: just Delete (no reply is sent).
      </p>
      {error && <p className="mt-3 text-red-600">{error}</p>}

      {loading ? (
        <p className="mt-6 text-gray-500">Loading…</p>
      ) : subs.length === 0 ? (
        <p className="mt-6 text-gray-500">No submissions to review.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm bg-white rounded-lg shadow">
            <thead className="text-left text-gray-500 border-b">
              <tr>
                <th className="p-3">Name</th><th className="p-3">Attending</th><th className="p-3">Party</th>
                <th className="p-3">Dietary</th><th className="p-3">Song</th><th className="p-3">Submitted</th>
                <th className="p-3">Last email</th><th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-b last:border-0 align-top">
                  <td className="p-3">
                    <div className="font-medium text-gray-900">{s.firstName} {s.lastName}</div>
                    <div className="text-gray-500">{s.email}</div>
                  </td>
                  <td className="p-3">{s.attending ? 'Yes' : s.attending === false ? 'No' : '—'}</td>
                  <td className="p-3">{s.rsvpdCount ?? '—'}</td>
                  <td className="p-3">{s.dietaryRestrictions || '—'}</td>
                  <td className="p-3">{s.songRequest || '—'}</td>
                  <td className="p-3">{s.rsvpReceivedAt ? new Date(s.rsvpReceivedAt).toLocaleDateString() : '—'}</td>
                  <td className="p-3">{s.emailLogs[0]?.status ?? '—'}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      <button disabled={busyId === s.id} onClick={() => approve(s)} className="px-2 py-1 rounded bg-[#00330a] text-white text-xs disabled:opacity-50">Approve</button>
                      <button disabled={busyId === s.id} onClick={() => openMatch(s)} className="px-2 py-1 rounded bg-amber-600 text-white text-xs disabled:opacity-50">Match</button>
                      <button disabled={busyId === s.id} onClick={() => send(s, 'venue_details')} className="px-2 py-1 rounded border border-[#00330a] text-[#00330a] text-xs disabled:opacity-50">Send info</button>
                      <button disabled={busyId === s.id} onClick={() => send(s, 'gracious_regrets')} className="px-2 py-1 rounded border border-gray-400 text-gray-700 text-xs disabled:opacity-50">Send regrets</button>
                      <button disabled={busyId === s.id} onClick={() => remove(s)} className="px-2 py-1 rounded bg-red-600 text-white text-xs disabled:opacity-50">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {matchFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-[#00330a]">Match to an invited guest</h2>
              <button onClick={() => setMatchFor(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Link <span className="font-medium">{matchFor.firstName} {matchFor.lastName}</span>’s RSVP to the right person on the invite list.
            </p>
            <div className="space-y-1">
              {guests.map((g) => (
                <button key={g.id} onClick={() => confirmMatch(g.id)}
                  className="w-full text-left px-3 py-2 rounded border hover:border-[#00330a] text-sm">
                  {g.firstName} {g.lastName} <span className="text-gray-400">{g.email}</span>
                </button>
              ))}
              {guests.length === 0 && <p className="text-gray-500 text-sm">Loading guests…</p>}
            </div>
          </div>
        </div>
      )}

      <WeddingDetailsEditor />
    </div>
  )
}

// Moved from the retired /admin/rsvps page — the venue_details email depends on these.
function WeddingDetailsEditor() {
  const [open, setOpen] = useState(false)
  const [details, setDetails] = useState({ date: '', time: '', venueName: '', venueAddress: '' })
  const [saved, setSaved] = useState('')

  useEffect(() => {
    fetch('/api/admin/rsvps').then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.details) setDetails({ date: d.details.date ?? '', time: d.details.time ?? '', venueName: d.details.venueName ?? '', venueAddress: d.details.venueAddress ?? '' })
    }).catch(() => {})
  }, [])

  async function save() {
    const res = await fetch('/api/admin/rsvps', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ details }),
    })
    setSaved(res.ok ? 'Saved.' : 'Save failed.')
    setTimeout(() => setSaved(''), 3000)
  }

  return (
    <div className="mt-10 bg-white rounded-lg shadow p-4">
      <button onClick={() => setOpen((o) => !o)} className="text-sm font-medium text-[#00330a]">
        {open ? '▾' : '▸'} Wedding details (used by the “you’re coming” email)
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(['date', 'time', 'venueName', 'venueAddress'] as const).map((k) => (
            <label key={k} className="text-sm">
              <span className="block text-gray-600 mb-1">{k}</span>
              <input value={details[k]} onChange={(e) => setDetails((d) => ({ ...d, [k]: e.target.value }))}
                className="w-full border rounded px-2 py-1" />
            </label>
          ))}
          <div className="sm:col-span-2 flex items-center gap-3">
            <button onClick={save} className="px-4 py-2 rounded bg-[#00330a] text-white text-sm">Save</button>
            {saved && <span className="text-sm text-gray-600">{saved}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
```

Note: confirm the `GET /api/admin/rsvps` response shape is `{ details: {...} }` before relying on it; if it differs, adapt the editor's parsing (this is the only field-shape assumption in the page).

- [ ] **Step 2: Build check**

Run: `npx next build 2>&1 | tail -8`
Expected: success; `/admin/review` in the route list.

- [ ] **Step 3: Commit**

```bash
git add app/admin/review/page.tsx
git commit -m "feat(review): To Review grid page with approve/match/delete + canned sends"
```

---

### Task 10: Retire the old /admin/rsvps bucket page

**Files:**
- Delete: `app/admin/rsvps/page.tsx`
- Modify: `app/admin/page.tsx` (only if it links to `/admin/rsvps`)

- [ ] **Step 1: Check for a dashboard link**

Run: `grep -rn "/admin/rsvps" app --include=*.tsx | grep -v "api/admin/rsvps"`
Expected: shows any UI links. The API routes (`app/api/admin/rsvps/*`) must stay — they're reused.

- [ ] **Step 2: Repoint any dashboard card** found in `app/admin/page.tsx` from `href="/admin/rsvps"` to `href="/admin/review"` (update the label to "To Review" / "Review RSVPs" if present). If no link exists, skip.

- [ ] **Step 3: Delete the bucket page**

```bash
git rm app/admin/rsvps/page.tsx
```

- [ ] **Step 4: Build check**

Run: `npx next build 2>&1 | tail -6`
Expected: success; `/admin/rsvps` gone from the route list, `/api/admin/rsvps/*` still present.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(review): retire the orphaned /admin/rsvps bucket page (superseded)"
```

---

### Task 11: Full verification + live smoke

**Files:** none (verification only)

- [ ] **Step 1: Full suite**

Run: `npx jest 2>&1 | tail -5`
Expected: all suites pass including the new review tests.

- [ ] **Step 2: Production build**

Run: `npx next build 2>&1 | tail -8`
Expected: success.

- [ ] **Step 3: Live smoke** (dev server via the Browser pane; the local dev DB already has `self_rsvp` rows or create one by submitting an unmatched RSVP at `/rsvp`).

1. Log in to `/admin`. Confirm "To Review" nav shows a badge if ≥1 pending.
2. Open `/admin/review` — unmatched submissions listed, no summary boxes.
3. Confirm those same people do NOT appear in `/admin/guests` and are NOT in the ATTENDING count.
4. **Approve** one → it leaves the queue, badge decrements, now appears in `/admin/guests` and the ATTENDING count.
5. **Match** another to an existing invited guest → submission disappears, the invited guest now shows the RSVP; over-cap warning fires when headcount > reserved seats.
6. **Send info** and **Send regrets** on a row → confirm dialog → "Last email" updates (check the dev inbox / EmailLog).
7. **Delete** a row → gone.
8. Edit + save the Wedding details section; confirm it persists on reload.

- [ ] **Step 4: Commit any smoke fixes**

```bash
git add -A && git commit -m "test(review): fixes from live smoke"  # only if needed
```

---

## Deploy runbook (after merge approval — push = Railway auto-deploy)

1. Merge `feature/rsvp-review-queue` → `main`, push. Railway runs `prisma migrate deploy` (adds the two nullable columns).
2. No env vars needed.
3. Prod smoke: repeat Task 11 step 3 against the live site; existing prod `self_rsvp` rows appear in the queue on first load (expected).

## Spec-coverage self-check

- New "To Review" tab (grid, no summary boxes) → Tasks 8, 9 ✓
- Unmatched excluded from Guest Management + counts → Tasks 3, 4 ✓
- View / Approve / Match / Delete → Tasks 6, 7, 9 (+ reused guest DELETE) ✓
- Match-to-existing-guest w/ over-cap warning → Task 7, 9 ✓
- One-click confirm/decline (reuse templates + send) → Task 9 (reuses send route) ✓
- reviewedAt/reviewedBy migration → Task 1 ✓
- Retire /admin/rsvps, keep wedding-details editor → Tasks 9, 10 ✓
- Admin auth guard on all new routes → Tasks 5, 6, 7 ✓

---

## Revision (2026-07-17) — Nicolle's three branded messages + "Message to Send" dropdown

Supersedes the earlier "reuse venue_details/gracious_regrets" approach. Adds Tasks 12–15.
**Task 9 change:** replace its two separate "Send info / Send regrets" buttons with the
shared `<MessageToSend>` dropdown from Task 14 (same three options).

Added file-map entries:

| File | Responsibility |
|---|---|
| `lib/email-templates.ts` | + `generateRsvpYesEmail`, `generateRsvpNoEmail`, `generateRsvpOverCountEmail` (registry-thank-you style) |
| `app/api/admin/rsvps/send/route.ts` | extend template enum + render branches for the 3 new templates |
| `components/admin/MessageToSend.tsx` | shared per-row dropdown (Yes/No/Incorrect) + confirm + send |
| `app/admin/guests/page.tsx` | add `<MessageToSend>` to each row |
| `scripts/seed-wedding-details.mjs` | seed the `wedding_details` Setting with the real venue |

---

### Task 12: Three branded RSVP message templates

**Files:**
- Modify: `lib/email-templates.ts`
- Test: `lib/__tests__/rsvp-messages.test.ts`

Style them after the existing `generateRegistryThankYouEmail` in the same file (same
wrapper markup / colors). Each returns `{ subject, html, text }`.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/__tests__/rsvp-messages.test.ts
import { generateRsvpYesEmail, generateRsvpNoEmail, generateRsvpOverCountEmail } from '@/lib/email-templates'

const details = { date: 'TBA', time: 'TBA', venueName: 'Blackstone Rivers Ranch', venueAddress: '3673 Chicago Creek Rd\nIdaho Springs, CO 80452' }

it('RSVP Yes includes the confirmation line and the venue from details', () => {
  const m = generateRsvpYesEmail('Sam', details)
  expect(m.subject).toMatch(/locked in|You're|invited/i)
  expect(m.html).toContain('Blackstone Rivers Ranch')
  expect(m.html).toContain('Idaho Springs')
  expect(m.text).toContain('locked in')
})

it('RSVP No is the sorry-to-miss-you acknowledgement, with no venue', () => {
  const m = generateRsvpNoEmail('Sam')
  expect(m.html).toMatch(/sorry to miss you/i)
  expect(m.html).not.toContain('Blackstone Rivers Ranch')
})

it('Over-count is personalized with name, submitted count, and invited seats', () => {
  const m = generateRsvpOverCountEmail('Sam', 5, 4)
  expect(m.html).toContain('Sam')
  expect(m.html).toContain('5')
  expect(m.html).toContain('4')
  expect(m.html).not.toContain('Blackstone Rivers Ranch')
})

it('Over-count degrades gracefully when invited seats are unknown', () => {
  const m = generateRsvpOverCountEmail('Sam', 5, null)
  expect(m.html).not.toContain('null')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/__tests__/rsvp-messages.test.ts`
Expected: FAIL — functions not exported

- [ ] **Step 3: Implement** — add to `lib/email-templates.ts`. First read `generateRegistryThankYouEmail` and reuse its exact HTML wrapper/escape helper (`escapeHtml`) and color constants so these match its look. Then add:

```typescript
export function generateRsvpYesEmail(firstName: string, details: WeddingDetails): EmailTemplate {
  const name = escapeHtml(firstName || 'there')
  const venueName = escapeHtml(details.venueName || 'our venue')
  const venueAddress = escapeHtml(details.venueAddress || '').replace(/\n/g, '<br>')
  const body = `
    <p>It's official—you're locked in! We received your RSVP and couldn't be happier.
    We're counting down the days until we get to celebrate together!</p>
    <p>Our venue is <strong>${venueName}</strong>.</p>
    ${venueAddress ? `<p>The address is:<br>${venueAddress}</p>` : ''}
  `
  const text = `It's official—you're locked in! We received your RSVP and couldn't be happier. `
    + `We're counting down the days until we get to celebrate together!\n\n`
    + `Our venue is ${details.venueName || 'our venue'}.\n`
    + (details.venueAddress ? `The address is:\n${details.venueAddress}\n` : '')
  return { subject: "You're locked in — Emme & Connor", html: wrapBrandedEmail(name, body), text }
}

export function generateRsvpNoEmail(firstName: string): EmailTemplate {
  const name = escapeHtml(firstName || 'there')
  const body = `<p>Thank you for updating your RSVP! We are so sorry to miss you on our
    special day, but we truly appreciate you letting us know.</p>`
  const text = `Thank you for updating your RSVP! We are so sorry to miss you on our special day, `
    + `but we truly appreciate you letting us know.`
  return { subject: 'Thank you for your RSVP — Emme & Connor', html: wrapBrandedEmail(name, body), text }
}

export function generateRsvpOverCountEmail(
  firstName: string, rsvpdCount: number | null, reservedSeats: number | null
): EmailTemplate {
  const name = escapeHtml(firstName || 'there')
  const submitted = rsvpdCount ?? 0
  const seatsPhrase = reservedSeats != null
    ? `the ${reservedSeats} spots listed on your invitation`
    : `the number of spots listed on your invitation`
  const body = `
    <p>Hi ${name}! We are so looking forward to having you at our wedding. We noticed your
    RSVP included ${submitted} guests, but due to our intimate guest count and venue space,
    we are only able to host ${seatsPhrase}. Let us know if you can still celebrate with us
    within that count—we'd love to have you!</p>
  `
  const text = `Hi ${firstName || 'there'}! We are so looking forward to having you at our wedding. `
    + `We noticed your RSVP included ${submitted} guests, but due to our intimate guest count `
    + `and venue space, we are only able to host ${reservedSeats != null ? `the ${reservedSeats} spots` : 'the spots'} `
    + `listed on your invitation. Let us know if you can still celebrate with us within that count—we'd love to have you!`
  return { subject: 'A quick note about your RSVP — Emme & Connor', html: wrapBrandedEmail(name, body), text }
}
```

If `generateRegistryThankYouEmail` does not already factor out a reusable wrapper, extract
a small local `wrapBrandedEmail(name, bodyHtml)` helper from its markup and have the
registry template call it too (DRY) — do not duplicate the full HTML shell three times.
`EmailTemplate` and `escapeHtml` already exist in this file; reuse them.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/__tests__/rsvp-messages.test.ts`
Expected: 4 passed. Then `npx jest lib/__tests__/email-templates.test.ts` — existing template tests still green.

- [ ] **Step 5: Commit**

```bash
git add lib/email-templates.ts lib/__tests__/rsvp-messages.test.ts
git commit -m "feat(review): three branded RSVP messages (yes/no/over-count) in thank-you style"
```

---

### Task 13: Extend the send endpoint with the three templates

**Files:**
- Modify: `app/api/admin/rsvps/send/route.ts`
- Test: `app/api/admin/rsvps/__tests__/send-templates.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/admin/rsvps/__tests__/send-templates.test.ts
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: {
  guest: { findMany: jest.fn() },
  setting: { findUnique: jest.fn() },
} }))
jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'm1' }),
  logEmail: jest.fn().mockResolvedValue(undefined),
  COORDINATOR_FROM: 'Coordinator <c@x.com>',
  NOTIFY_EMAIL: 'n@x.com',
}))

import { getServerSession } from 'next-auth'
import { POST } from '../send/route'
import { prisma } from '@/lib/prisma'
import { sendEmail, logEmail } from '@/lib/email'

const req = (body: unknown) => ({ json: async () => body }) as never

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
  ;(prisma.setting.findUnique as jest.Mock).mockResolvedValue({ value: JSON.stringify({ date:'TBA', time:'TBA', venueName:'Blackstone Rivers Ranch', venueAddress:'3673 Chicago Creek Rd' }) })
  ;(prisma.guest.findMany as jest.Mock).mockResolvedValue([
    { id: '11111111-1111-1111-1111-111111111111', firstName: 'Sam', email: 's@x.com', rsvpdCount: 5, reservedSeats: 4 },
  ])
})

it('accepts rsvp_yes and logs gated_rsvp_yes', async () => {
  const res = (await POST(req({ guestIds: ['11111111-1111-1111-1111-111111111111'], template: 'rsvp_yes' }))) as { status: number }
  expect(res.status).toBe(200)
  expect(sendEmail).toHaveBeenCalled()
  expect((logEmail as jest.Mock).mock.calls[0][0].emailType).toBe('gated_rsvp_yes')
})

it('rsvp_over_count renders with the guest counts', async () => {
  await POST(req({ guestIds: ['11111111-1111-1111-1111-111111111111'], template: 'rsvp_over_count' }))
  const sent = (sendEmail as jest.Mock).mock.calls[0][0]
  expect(sent.html).toContain('5')
  expect(sent.html).toContain('4')
})

it('rsvp_no sends the acknowledgement', async () => {
  const res = (await POST(req({ guestIds: ['11111111-1111-1111-1111-111111111111'], template: 'rsvp_no' }))) as { status: number }
  expect(res.status).toBe(200)
  expect((logEmail as jest.Mock).mock.calls[0][0].emailType).toBe('gated_rsvp_no')
})

it('rejects an unknown template', async () => {
  const res = (await POST(req({ guestIds: ['11111111-1111-1111-1111-111111111111'], template: 'bogus' }))) as { status: number }
  expect(res.status).toBe(400)
})

it('401s non-admin', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  const res = (await POST(req({ guestIds: ['11111111-1111-1111-1111-111111111111'], template: 'rsvp_yes' }))) as { status: number }
  expect(res.status).toBe(401)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/admin/rsvps/__tests__/send-templates.test.ts`
Expected: FAIL — new template values rejected by the enum

- [ ] **Step 3: Edit `app/api/admin/rsvps/send/route.ts`**

Update imports:
```typescript
import {
  generateVenueDetailsEmail,
  generateGraciousRegretsEmail,
  generateRsvpYesEmail,
  generateRsvpNoEmail,
  generateRsvpOverCountEmail,
  generateWeddingIcs,
  WeddingDetails,
} from '@/lib/email-templates'
```
Extend the enum:
```typescript
const sendSchema = z.object({
  guestIds: z.array(z.string().uuid()).min(1).max(100),
  template: z.enum(['venue_details', 'gracious_regrets', 'rsvp_yes', 'rsvp_no', 'rsvp_over_count']),
  dryRun: z.boolean().optional(),
})
```
Replace the `render` helper (currently `render(firstName)`) with a per-guest renderer that
has access to counts + details:
```typescript
  type GuestRow = { firstName: string; rsvpdCount: number | null; reservedSeats: number | null }
  const render = (g: GuestRow) => {
    switch (template) {
      case 'rsvp_yes': return generateRsvpYesEmail(g.firstName, details)
      case 'rsvp_no': return generateRsvpNoEmail(g.firstName)
      case 'rsvp_over_count': return generateRsvpOverCountEmail(g.firstName, g.rsvpdCount, g.reservedSeats)
      case 'gracious_regrets': return generateGraciousRegretsEmail(g.firstName)
      case 'venue_details':
      default: return generateVenueDetailsEmail(g.firstName, details)
    }
  }
```
Update the dry-run and send loop to pass the guest object:
```typescript
  if (dryRun) {
    const sample = guests[0]
    return NextResponse.json({ preview: render(sample ?? { firstName: '', rsvpdCount: null, reservedSeats: null }), recipients: guests.length })
  }
```
```typescript
    const tpl = render(guest)
```
Attach the `.ics` for the venue-bearing templates (now `rsvp_yes` as well as `venue_details`):
```typescript
  if (template === 'venue_details' || template === 'rsvp_yes') {
    const ics = generateWeddingIcs(details)
    if (ics) attachments = [{ filename: 'Emme-Connor-Wedding.ics', content: Buffer.from(ics).toString('base64') }]
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/admin/rsvps/__tests__/send-templates.test.ts`
Expected: 5 passed. Full suite tail — no regressions (the retired page's absence doesn't affect the route).

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/rsvps/send/route.ts app/api/admin/rsvps/__tests__/send-templates.test.ts
git commit -m "feat(review): send endpoint supports the three branded RSVP messages"
```

---

### Task 14: Shared `<MessageToSend>` dropdown + wire into both grids

**Files:**
- Create: `components/admin/MessageToSend.tsx`
- Modify: `app/admin/review/page.tsx` (replace the two send buttons from Task 9)
- Modify: `app/admin/guests/page.tsx` (add to each row)

UI task (build + live smoke). The component is a small select + Send button that POSTs to
`/api/admin/rsvps/send` for one guest, with a confirm dialog.

- [ ] **Step 1: Create the component**

```tsx
// components/admin/MessageToSend.tsx
'use client'

import { useState } from 'react'

type Template = 'rsvp_yes' | 'rsvp_no' | 'rsvp_over_count'
const OPTIONS: { value: Template; label: string; confirm: string }[] = [
  { value: 'rsvp_yes', label: 'RSVP Yes', confirm: 'the “you’re locked in” confirmation (with venue)' },
  { value: 'rsvp_no', label: 'RSVP No', confirm: 'the “sorry to miss you” note' },
  { value: 'rsvp_over_count', label: 'Incorrect RSVP', confirm: 'the “too many guests” note' },
]

export function MessageToSend({ guestId, email, onSent }: { guestId: string; email: string | null; onSent?: () => void }) {
  const [template, setTemplate] = useState<Template | ''>('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function send() {
    if (!template) return
    if (!email) { setMsg('No email on file'); return }
    const opt = OPTIONS.find((o) => o.value === template)!
    if (!confirm(`Send ${opt.confirm} to ${email}?`)) return
    setBusy(true); setMsg('')
    try {
      const res = await fetch('/api/admin/rsvps/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestIds: [guestId], template }),
      })
      if (!res.ok) throw new Error()
      setMsg('Sent ✓'); setTemplate(''); onSent?.()
    } catch { setMsg('Failed') } finally { setBusy(false) }
  }

  return (
    <div className="flex items-center gap-1">
      <select
        value={template}
        onChange={(e) => setTemplate(e.target.value as Template | '')}
        className="border rounded px-1 py-1 text-xs"
        aria-label="Message to send"
      >
        <option value="">Message…</option>
        {OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button disabled={!template || busy} onClick={send}
        className="px-2 py-1 rounded bg-[#00330a] text-white text-xs disabled:opacity-40">Send</button>
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
    </div>
  )
}
```

- [ ] **Step 2: Use it in the review page** — in `app/admin/review/page.tsx`, remove the
two `send(s, 'venue_details')` / `send(s, 'gracious_regrets')` buttons and the `send`
helper added in Task 9, and render `<MessageToSend guestId={s.id} email={s.email} onSent={refresh} />`
in the actions cell instead. Import it: `import { MessageToSend } from '@/components/admin/MessageToSend'`.

- [ ] **Step 3: Use it in Guest Management** — in `app/admin/guests/page.tsx`, import the
component and add it to each row's actions cell (near View/Edit/Delete):
`<MessageToSend guestId={guest.id} email={guest.email} />`. (The `Guest` type in that file
already has `id` and `email`.)

- [ ] **Step 4: Build check**

Run: `npx next build 2>&1 | tail -6`
Expected: success; `/admin/review` and `/admin/guests` compile.

- [ ] **Step 5: Commit**

```bash
git add components/admin/MessageToSend.tsx app/admin/review/page.tsx app/admin/guests/page.tsx
git commit -m "feat(review): shared Message-to-Send dropdown on both guest grids"
```

---

### Task 15: Seed the wedding-details Setting with the real venue

**Files:**
- Create: `scripts/seed-wedding-details.mjs`

- [ ] **Step 1: Write the seed script**

```javascript
// scripts/seed-wedding-details.mjs
// Seeds the wedding_details Setting used by the RSVP-Yes email. Idempotent (upsert).
// Run locally: node scripts/seed-wedding-details.mjs
// Prod: DATABASE_URL=<public> node scripts/seed-wedding-details.mjs (see registry seed note)
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const details = {
  date: 'TBA',
  time: 'TBA',
  venueName: 'Blackstone Rivers Ranch',
  venueAddress: '3673 Chicago Creek Rd\nIdaho Springs, CO 80452',
}

await prisma.setting.upsert({
  where: { key: 'wedding_details' },
  update: { value: JSON.stringify(details) },
  create: { key: 'wedding_details', value: JSON.stringify(details) },
})
console.log('Seeded wedding_details:', details.venueName)
await prisma.$disconnect()
```

Note: `date`/`time` stay TBA until finalized — the admin can edit them in the Wedding
Details editor on the review page. Only `venueName`/`venueAddress` are pre-filled now.

- [ ] **Step 2: Run against local dev DB**

Run: `node scripts/seed-wedding-details.mjs`
Expected: `Seeded wedding_details: Blackstone Rivers Ranch`. Verify the RSVP-Yes preview
then shows the venue (covered in Task 11 live smoke, step 6).

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-wedding-details.mjs
git commit -m "chore(review): idempotent seed for the wedding_details venue Setting"
```

---

## Revision spec-coverage self-check (2026-07-17)

- "Message to Send" dropdown on both grids → Tasks 14 (component + both pages) ✓
- Three branded messages, thank-you style → Task 12 ✓
- RSVP Yes carries venue from editable Setting → Tasks 12, 13, 15 ✓
- Over-count personalized (name + counts), graceful null → Task 12 ✓
- Send endpoint supports the three + logs them → Task 13 ✓
- Venue stays gated (email only, never public) → venue lives only in Setting + email templates; no public route renders it (unchanged from prior privacy sweep) ✓
- Task 9's separate send buttons replaced by the shared dropdown → Task 14 step 2 ✓
