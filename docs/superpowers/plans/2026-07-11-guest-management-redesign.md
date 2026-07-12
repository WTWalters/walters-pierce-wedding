# Guest Management Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the admin Guest Management page and dashboard around real parties — partner names, reserved-seat capacity with a hard cap, an RSVP'd count, corrected stat boxes, a usable edit modal, and a slimmed 3-tile dashboard.

**Architecture:** Additive Prisma migration adds four nullable `Guest` columns. Server routes (`stats`, `guests`, `guests/[id]`) enforce the reserved-seats cap and compute the new totals. `lib/rsvp.ts` gains partner-name matching. The client page (`app/admin/guests/page.tsx`) renders 4 stat boxes, new list columns, a combined-couple name, and an enlarged edit modal with the new fields. The dashboard (`app/admin/page.tsx`) drops six tiles.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma 6 + PostgreSQL, NextAuth (credentials), Tailwind, Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-11-guest-management-redesign-design.md`

---

### Task 1: Data model — party fields + migration

**Files:**
- Modify: `prisma/schema.prisma` (the `Guest` model, ~`:24-52`)
- Create: `prisma/migrations/<timestamp>_guest_party_fields/migration.sql` (generated)

- [ ] **Step 1: Add the four nullable columns to the `Guest` model**

Insert after `songRequest         String?    @map("song_request")`:

```prisma
  partnerFirstName    String?    @map("partner_first_name")
  partnerLastName     String?    @map("partner_last_name")
  reservedSeats       Int?       @map("reserved_seats")
  rsvpdCount          Int?       @map("rsvpd_count")
```

- [ ] **Step 2: Generate the migration (no data loss — all nullable)**

Run: `npx prisma migrate dev --name guest_party_fields`
Expected: new migration folder created, `prisma generate` runs, existing 64 rows unaffected (new columns default `NULL`).

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(guests): add partner name, reserved seats, rsvpd count fields"
```

---

### Task 2: Stats API — new totals

**Files:**
- Modify: `app/api/admin/guests/stats/route.ts`
- Test: `app/api/admin/guests/__tests__/stats-route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: { guest: { count: jest.fn(), aggregate: jest.fn() } },
}))

import { GET } from '../stats/route'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

const mockSession = getServerSession as jest.Mock
const mockPrisma = prisma as jest.Mocked<any>

beforeEach(() => {
  jest.clearAllMocks()
  mockSession.mockResolvedValue({ user: { role: 'admin' } })
})

it('totalInvited is the sum of reservedSeats; rsvpReceived = attending + notAttending', async () => {
  mockPrisma.guest.aggregate.mockResolvedValue({ _sum: { reservedSeats: 117 } })
  // order: attending, notAttending
  mockPrisma.guest.count.mockResolvedValueOnce(7).mockResolvedValueOnce(2)

  const res: any = await GET({} as any)

  expect(res.body.totalInvited).toBe(117)
  expect(res.body.attending).toBe(7)
  expect(res.body.notAttending).toBe(2)
  expect(res.body.rsvpReceived).toBe(9)
  expect(res.body).not.toHaveProperty('plusOnes')
  expect(res.body).not.toHaveProperty('invited')
})

it('returns 401 when not admin', async () => {
  mockSession.mockResolvedValue(null)
  const res: any = await GET({} as any)
  expect(res.status).toBe(401)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/admin/guests/__tests__/stats-route.test.ts`
Expected: FAIL (`totalInvited` undefined; `plusOnes`/`invited` still present).

- [ ] **Step 3: Rewrite the stats route**

Replace the body of `GET` (the `Promise.all` block through the `stats` object) with:

```typescript
    const [attending, notAttending, seatSum] = await Promise.all([
      prisma.guest.count({ where: { attending: true } }),
      prisma.guest.count({ where: { attending: false } }),
      prisma.guest.aggregate({ _sum: { reservedSeats: true } }),
    ])

    const totalInvited = seatSum._sum.reservedSeats ?? 0
    const rsvpReceived = attending + notAttending

    const stats = { totalInvited, rsvpReceived, attending, notAttending }

    return NextResponse.json(stats)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/admin/guests/__tests__/stats-route.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/guests/stats/route.ts app/api/admin/guests/__tests__/stats-route.test.ts
git commit -m "feat(guests): stats show total invited (sum of seats) and derived rsvp received"
```

---

### Task 3: Reserved-seats cap invariant (POST + PUT)

> **LEARNING CONTRIBUTION POINT** — the cap check is the one real business rule here. During execution I'll invite you to write `assertSeatCap` before revealing the reference below.

**Files:**
- Create: `lib/guests.ts`
- Test: `lib/__tests__/guests.test.ts`
- Modify: `app/api/admin/guests/route.ts` (POST), `app/api/admin/guests/[id]/route.ts` (PUT)

- [ ] **Step 1: Write the failing test**

```typescript
import { assertSeatCap } from '@/lib/guests'

describe('assertSeatCap', () => {
  it('rejects rsvpd greater than reserved', () => {
    expect(assertSeatCap({ reservedSeats: 7, rsvpdCount: 9 }))
      .toEqual({ ok: false, message: 'RSVP count (9) exceeds reserved seats (7) for this party' })
  })
  it('allows rsvpd equal to reserved', () => {
    expect(assertSeatCap({ reservedSeats: 7, rsvpdCount: 7 })).toEqual({ ok: true })
  })
  it('allows rsvpd below reserved', () => {
    expect(assertSeatCap({ reservedSeats: 7, rsvpdCount: 2 })).toEqual({ ok: true })
  })
  it('is a no-op when either value is null/undefined', () => {
    expect(assertSeatCap({ reservedSeats: null, rsvpdCount: 9 })).toEqual({ ok: true })
    expect(assertSeatCap({ reservedSeats: 7, rsvpdCount: null })).toEqual({ ok: true })
    expect(assertSeatCap({})).toEqual({ ok: true })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/__tests__/guests.test.ts`
Expected: FAIL ("Cannot find module '@/lib/guests'").

- [ ] **Step 3: Write minimal implementation**

Create `lib/guests.ts`:

```typescript
export type SeatCapInput = {
  reservedSeats?: number | null
  rsvpdCount?: number | null
}

export type SeatCapResult = { ok: true } | { ok: false; message: string }

/**
 * A party's RSVP'd headcount may never exceed its reserved seats.
 * Null on either side means "not set yet" — no constraint to enforce.
 */
export function assertSeatCap({ reservedSeats, rsvpdCount }: SeatCapInput): SeatCapResult {
  if (
    reservedSeats != null &&
    rsvpdCount != null &&
    rsvpdCount > reservedSeats
  ) {
    return {
      ok: false,
      message: `RSVP count (${rsvpdCount}) exceeds reserved seats (${reservedSeats}) for this party`,
    }
  }
  return { ok: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/__tests__/guests.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Wire the cap into PUT** (`app/api/admin/guests/[id]/route.ts`)

Add import at top: `import { assertSeatCap } from '@/lib/guests'`

After the email-uniqueness check and before `prisma.guest.update`, insert:

```typescript
    const reservedSeats = body.reservedSeats != null && body.reservedSeats !== '' ? parseInt(body.reservedSeats) : null
    const rsvpdCount = body.rsvpdCount != null && body.rsvpdCount !== '' ? parseInt(body.rsvpdCount) : null
    const cap = assertSeatCap({ reservedSeats, rsvpdCount })
    if (!cap.ok) {
      return NextResponse.json({ error: cap.message }, { status: 400 })
    }
```

Then extend the `data:` object in `prisma.guest.update` with:

```typescript
        partnerFirstName: body.partnerFirstName || null,
        partnerLastName: body.partnerLastName || null,
        reservedSeats,
        rsvpdCount,
        songRequest: body.songRequest || null,
```

- [ ] **Step 6: Wire the cap into POST** (`app/api/admin/guests/route.ts`)

Add import: `import { assertSeatCap } from '@/lib/guests'`

Destructure the new fields from `data` (extend the existing destructure):

```typescript
    const { firstName, lastName, email, phone, addressLine1, addressLine2, city, state, zipCode, notes,
            partnerFirstName, partnerLastName, reservedSeats: rawSeats, rsvpdCount: rawRsvpd, songRequest } = data
    const reservedSeats = rawSeats != null && rawSeats !== '' ? parseInt(rawSeats) : null
    const rsvpdCount = rawRsvpd != null && rawRsvpd !== '' ? parseInt(rawRsvpd) : null
    const cap = assertSeatCap({ reservedSeats, rsvpdCount })
    if (!cap.ok) {
      return NextResponse.json({ error: cap.message }, { status: 400 })
    }
```

Extend the `prisma.guest.create` `data:` object with:

```typescript
        partnerFirstName: partnerFirstName || null,
        partnerLastName: partnerLastName || null,
        reservedSeats,
        rsvpdCount,
        songRequest: songRequest || null,
```

- [ ] **Step 7: Run the full suite to confirm no regressions**

Run: `npx jest lib/__tests__/guests.test.ts app/api/admin/guests`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/guests.ts lib/__tests__/guests.test.ts app/api/admin/guests/route.ts "app/api/admin/guests/[id]/route.ts"
git commit -m "feat(guests): enforce rsvpd count cannot exceed reserved seats"
```

---

### Task 4: `formatPartyName` helper

**Files:**
- Modify: `lib/guests.ts`
- Test: `lib/__tests__/guests.test.ts`

- [ ] **Step 1: Write the failing test** (append to `lib/__tests__/guests.test.ts`)

```typescript
import { formatPartyName } from '@/lib/guests'

describe('formatPartyName', () => {
  it('joins a couple with an ampersand', () => {
    expect(formatPartyName({
      firstName: 'Andre', lastName: 'Justen-Pratt',
      partnerFirstName: 'Chloe', partnerLastName: 'Hirai',
    })).toBe('Andre Justen-Pratt & Chloe Hirai')
  })
  it('returns a single name when no partner', () => {
    expect(formatPartyName({ firstName: 'Amethyst', lastName: 'Johannes' }))
      .toBe('Amethyst Johannes')
  })
  it('handles a partner first name with no partner last name', () => {
    expect(formatPartyName({
      firstName: 'Ben', lastName: 'Bright', partnerFirstName: 'Jessica',
    })).toBe('Ben Bright & Jessica')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/__tests__/guests.test.ts -t formatPartyName`
Expected: FAIL ("formatPartyName is not a function").

- [ ] **Step 3: Implement** (append to `lib/guests.ts`)

```typescript
export type PartyNameInput = {
  firstName: string
  lastName: string
  partnerFirstName?: string | null
  partnerLastName?: string | null
}

/** Renders the party's display name: "A B" or "A B & C D". */
export function formatPartyName(g: PartyNameInput): string {
  const primary = `${g.firstName} ${g.lastName}`.trim()
  if (!g.partnerFirstName) return primary
  const partner = `${g.partnerFirstName} ${g.partnerLastName ?? ''}`.trim()
  return `${primary} & ${partner}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/__tests__/guests.test.ts -t formatPartyName`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/guests.ts lib/__tests__/guests.test.ts
git commit -m "feat(guests): add formatPartyName helper for couple display"
```

---

### Task 5: Partner-name matching in `lib/rsvp.ts`

> **LEARNING CONTRIBUTION POINT** — extending the matcher touches the security invariant (a name match must never overwrite the email on file). During execution I'll invite you to write the matching predicate before revealing the reference.

**Files:**
- Modify: `lib/rsvp.ts` (`:96-103`)
- Test: `lib/__tests__/rsvp.test.ts`

- [ ] **Step 1: Write the failing test** (append a case to `lib/__tests__/rsvp.test.ts`)

```typescript
it('matches a submission against a party partner name without overwriting email on file', async () => {
  mockPrisma.guest.findUnique.mockResolvedValue(null) // no email match
  mockPrisma.guest.findMany.mockResolvedValue([
    { id: 'g1', email: 'andre@x.com', firstName: 'Andre', lastName: 'Justen-Pratt',
      partnerFirstName: 'Chloe', partnerLastName: 'Hirai', source: 'imported' },
  ])
  mockPrisma.guest.update.mockResolvedValue({ id: 'g1' })

  const res = await processRsvpSubmission({
    firstName: 'Chloe', lastName: 'Hirai', email: 'chloe-new@x.com',
    attending: true, partySize: 2,
  })

  expect(res).toEqual({ outcome: 'saved', matched: true })
  expect(mockPrisma.guest.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 'g1' } })
  )
  // email on file is NOT overwritten by a name match
  const updateArg = mockPrisma.guest.update.mock.calls[0][0]
  expect(updateArg.data.email).toBeUndefined()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/__tests__/rsvp.test.ts -t "partner name"`
Expected: FAIL (partner not matched → a new guest is created instead of updating g1).

- [ ] **Step 3: Extend the name matcher** (`lib/rsvp.ts`)

Update the `findMany` select to include partner fields, and broaden the filter. Replace lines `:97-103`:

```typescript
    const named = await prisma.guest.findMany({
      where: { NOT: [{ firstName: '' }, { lastName: '' }] },
      select: {
        id: true, email: true, firstName: true, lastName: true, source: true,
        partnerFirstName: true, partnerLastName: true,
      },
    })
    const nameMatches = named.filter((g) => {
      const primary = normalizeName(`${g.firstName} ${g.lastName}`)
      const partner = g.partnerFirstName
        ? normalizeName(`${g.partnerFirstName} ${g.partnerLastName ?? ''}`)
        : null
      return primary === submittedName || partner === submittedName
    })
```

The existing `nameMatches.length === 1` branch already updates by id **without** writing `email` — the security invariant is preserved unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/__tests__/rsvp.test.ts`
Expected: PASS (new case + all existing rsvp tests).

- [ ] **Step 5: Commit**

```bash
git add lib/rsvp.ts lib/__tests__/rsvp.test.ts
git commit -m "feat(rsvp): match submissions against party partner names"
```

---

### Task 6: Guest page — types + 4 stat boxes

**Files:**
- Modify: `app/admin/guests/page.tsx` (`Guest` interface `:5-35`, `GuestStats` `:37-58`, stat cards `:337-363`)

- [ ] **Step 1: Extend the `Guest` interface**

Add inside `interface Guest` (after `notes?: string`):

```typescript
  partnerFirstName?: string
  partnerLastName?: string
  reservedSeats?: number | null
  rsvpdCount?: number | null
  songRequest?: string
```

- [ ] **Step 2: Replace `GuestStats` and its initial state**

Replace the `GuestStats` interface with:

```typescript
interface GuestStats {
  totalInvited: number
  rsvpReceived: number
  attending: number
  notAttending: number
}
```

Replace the `useState<GuestStats>` initializer with:

```typescript
  const [stats, setStats] = useState<GuestStats>({
    totalInvited: 0,
    rsvpReceived: 0,
    attending: 0,
    notAttending: 0,
  })
```

- [ ] **Step 3: Replace the stat-cards grid** (`:338-363`)

```tsx
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-900">{stats.totalInvited}</div>
          <div className="text-blue-800 text-sm">Total Guests Invited</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-yellow-900">{stats.rsvpReceived}</div>
          <div className="text-yellow-800 text-sm">RSVP Received</div>
        </div>
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-900">{stats.attending}</div>
          <div className="text-green-800 text-sm">Attending</div>
        </div>
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-red-900">{stats.notAttending}</div>
          <div className="text-red-800 text-sm">Not Attending</div>
        </div>
      </div>
```

- [ ] **Step 4: Verify build/type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `stats.total`, `stats.invited`, or `stats.plusOnes`.

- [ ] **Step 5: Commit**

```bash
git add app/admin/guests/page.tsx
git commit -m "feat(guests): 4 stat boxes (total invited, rsvp received, attending, not attending)"
```

---

### Task 7: Guest page — enlarge edit modal + new fields + client cap guard

**Files:**
- Modify: `app/admin/guests/page.tsx` (edit modal `:743-905`, add a helper import)

- [ ] **Step 1: Import the cap helper** (top of file, after the React import)

```typescript
import { assertSeatCap, formatPartyName } from '@/lib/guests'
```

- [ ] **Step 2: Enlarge the modal container**

In the edit modal, change:

```tsx
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-96 overflow-y-auto">
```

to:

```tsx
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[85vh] overflow-y-auto">
```

- [ ] **Step 3: Add the new fields** — insert these blocks inside the edit `<form>` grid, right after the Attending `<div>` (`:864`):

```tsx
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Partner First Name</label>
                  <input
                    type="text"
                    value={editingGuest.partnerFirstName || ''}
                    onChange={(e) => setEditingGuest({...editingGuest, partnerFirstName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Partner Last Name</label>
                  <input
                    type="text"
                    value={editingGuest.partnerLastName || ''}
                    onChange={(e) => setEditingGuest({...editingGuest, partnerLastName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reserved Seats (number in party)</label>
                  <input
                    type="number"
                    min={0}
                    value={editingGuest.reservedSeats ?? ''}
                    onChange={(e) => setEditingGuest({...editingGuest, reservedSeats: e.target.value ? parseInt(e.target.value) : null})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number RSVP&apos;d</label>
                  <input
                    type="number"
                    min={0}
                    value={editingGuest.rsvpdCount ?? ''}
                    onChange={(e) => setEditingGuest({...editingGuest, rsvpdCount: e.target.value ? parseInt(e.target.value) : null})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Favorite Song</label>
                  <input
                    type="text"
                    value={editingGuest.songRequest || ''}
                    onChange={(e) => setEditingGuest({...editingGuest, songRequest: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
```

- [ ] **Step 4: Add the inline cap guard** — just above the form's submit button row (`:886`), insert:

```tsx
                {editingGuest && assertSeatCap({ reservedSeats: editingGuest.reservedSeats, rsvpdCount: editingGuest.rsvpdCount }).ok === false && (
                  <div className="md:col-span-2 lg:col-span-3 text-sm text-red-700">
                    {(assertSeatCap({ reservedSeats: editingGuest.reservedSeats, rsvpdCount: editingGuest.rsvpdCount }) as { message: string }).message}
                  </div>
                )}
```

And disable Save when the cap is violated — change the submit `<button>` to include:

```tsx
                    disabled={!assertSeatCap({ reservedSeats: editingGuest.reservedSeats, rsvpdCount: editingGuest.rsvpdCount }).ok}
                    className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
```

- [ ] **Step 5: Verify type-check + manual smoke**

Run: `npx tsc --noEmit`
Then `npm run dev`, open `/admin/guests`, edit a guest: confirm the modal shows all fields with Save reachable, and setting RSVP'd (9) above Reserved Seats (7) shows the red error and disables Save.

- [ ] **Step 6: Commit**

```bash
git add app/admin/guests/page.tsx
git commit -m "feat(guests): enlarge edit modal; add partner, seats, rsvpd, song fields with cap guard"
```

---

### Task 8: Guest page — list columns (combined name, party numbers)

**Files:**
- Modify: `app/admin/guests/page.tsx` (table head `:552-569`, rows `:572-632`)

- [ ] **Step 1: Replace the table header row**

```tsx
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number in Party</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number RSVP&apos;d</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
```

- [ ] **Step 2: Replace the row body** (the `<tr>` contents inside `filteredGuests.map`)

```tsx
                <tr key={guest.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{formatPartyName(guest)}</div>
                    {guest.invitationCode && (
                      <div className="text-sm text-gray-500 font-mono">Code: {guest.invitationCode}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(guest)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{guest.reservedSeats ?? ''}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{guest.rsvpdCount ?? ''}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onClick={() => setSelectedGuest(guest)} className="text-blue-600 hover:text-blue-900 mr-3">View</button>
                    <button className="text-green-600 hover:text-green-900 mr-3" onClick={() => startEditGuest(guest)}>Edit</button>
                    <button className="text-red-600 hover:text-red-900" onClick={() => deleteGuest(guest.id, formatPartyName(guest))}>Delete</button>
                  </td>
                </tr>
```

- [ ] **Step 3: Update the search filter to include partner name** (`filterAndSortGuests`, `:111-115`) — add two clauses to `matchesSearch`:

```typescript
        (guest.partnerFirstName && guest.partnerFirstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (guest.partnerLastName && guest.partnerLastName.toLowerCase().includes(searchTerm.toLowerCase())) ||
```

- [ ] **Step 4: Verify type-check + manual smoke**

Run: `npx tsc --noEmit`
Then reload `/admin/guests`: a couple row shows "Andre Justen-Pratt & Chloe Hirai"; Number in Party / Number RSVP'd columns render.

- [ ] **Step 5: Commit**

```bash
git add app/admin/guests/page.tsx
git commit -m "feat(guests): list shows combined party name, seats and rsvpd columns"
```

---

### Task 9: Dashboard — three tiles

**Files:**
- Modify: `app/admin/page.tsx` (`adminActions` array `:62-138`)

- [ ] **Step 1: Reduce `adminActions` to the three Nicolle keeps**

Replace the entire `adminActions` array with only these three entries (preserve each object's existing `description`, `icon`/emoji, and color fields as they are in the current file — only the set of entries changes):

```typescript
  const adminActions = [
    {
      title: 'Guest Management',
      description: 'Manage the guest list, record RSVPs, and track attendance',
      href: '/admin/guests',
      // keep existing icon + color fields for this tile
    },
    {
      title: 'Photo Gallery',
      description: 'Manage wedding photos and guest uploads',
      href: '/admin/photos',
      // keep existing icon + color fields for this tile
    },
    {
      title: 'Registry & Gifts',
      description: 'Honeymoon fund and gift registry',
      href: '/admin/registry',
      // keep existing icon + color fields for this tile
    },
  ]
```

Removed: RSVPs & Communications, To-Do List, Venue & Events, Wedding Party, Email Management, Save-the-Date Campaign, Settings.

- [ ] **Step 2: Preserve Admin Users access** — below the Quick Actions grid (after the `.map` block closes, ~`:190`), add a secondary link so the coordinator login page is still reachable:

```tsx
        <div className="mt-6 text-sm">
          <a href="/admin/users" className="text-gray-500 hover:text-gray-700 underline">Manage admin users</a>
        </div>
```

- [ ] **Step 3: Verify type-check + manual smoke**

Run: `npx tsc --noEmit`
Then load `/admin`: exactly three tiles (Guest Management, Photo Gallery, Registry & Gifts) plus the "Manage admin users" link. Confirm the top dashboard stat cards still render (they read from `/api/admin/stats`, unchanged).

- [ ] **Step 4: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat(dashboard): reduce quick actions to Guest Management, Photos, Registry"
```

---

### Task 10: Full verification

- [ ] **Step 1: Run the whole test suite**

Run: `npx jest`
Expected: all green (new tests + existing).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual end-to-end smoke on dev** (`npm run dev`)
  - `/admin`: three tiles + admin-users link.
  - `/admin/guests`: 4 stat boxes; set a guest's Reserved Seats and Number RSVP'd; try RSVP'd > seats → blocked both client (disabled Save) and server (400 if forced).
  - Set partner fields on a couple → row shows "A & B"; search finds them by partner name.
  - Backfill a couple of `reservedSeats` → Total Guests Invited increases by the sum.

- [ ] **Step 4: Final commit (if any smoke fixes)**

```bash
git add -A
git commit -m "chore(guests): guest management redesign verification pass"
```

---

## Self-review notes

- **Spec coverage:** dashboard 9→3 (T9), stat boxes 6→4 (T2,T6), partner name (T1,T6,T8), reserved seats + cap (T1,T3,T7), rsvpd count (T1,T6,T7,T8), favorite song surfaced (T7), modal resize (T7), combined name (T4,T8), matching (T5). Deferred items (email relocation, Photo/Gifts pages) intentionally excluded per spec scope.
- **Open item for Nicolle:** Settings tile dropped; Admin Users kept as a secondary link (T9 Step 2) rather than a tile — confirm this matches her intent.
- **Type consistency:** `assertSeatCap` / `formatPartyName` signatures identical across `lib/guests.ts`, routes, and page. Stats keys (`totalInvited`, `rsvpReceived`, `attending`, `notAttending`) match between route (T2) and page state (T6).
