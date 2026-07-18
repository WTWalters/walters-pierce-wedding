# Email Analytics Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Nicolle an admin "Emails" tab showing who was sent what and when, whether it delivered/opened/bounced/failed, plus six at-a-glance stats and a refresh button — built on the already-deployed Resend webhook + `EmailLog` tracking.

**Architecture:** No schema change. One pure helper module (type labels + derived per-row status), a rewritten stats endpoint (six correct tiles), a new list endpoint (newest 500, `?type=` filter), and a client page + nav tab. The Resend webhook that populates opened/bounced/delivered already exists and is deployed.

**Tech Stack:** Next.js 15 App Router, Prisma/PostgreSQL, NextAuth (admin guard), Tailwind, Jest (babel-jest, mocked next/server + next-auth + @/lib/prisma). Run tests/build under Node 22 (`nvm use 22` — Node 16 crashes Prisma 6).

**Spec:** `docs/superpowers/specs/2026-07-18-email-analytics-tab-design.md`

---

## File Structure

- Create `lib/email-status.ts` — pure helpers: `deriveEmailStatus(row)`, `emailTypeLabel(type)`, `EMAIL_STATUS_META`. Shared by the page (and testable in isolation).
- Create `lib/__tests__/email-status.test.ts` — helper tests.
- Modify `app/api/admin/email/stats/route.ts` — rewrite to six correct tiles.
- Create `app/api/admin/email/__tests__/stats-route.test.ts` — stats tests.
- Create `app/api/admin/emails/route.ts` — list endpoint (`?type=`, cap 500).
- Create `app/api/admin/emails/__tests__/list-route.test.ts` — list tests.
- Create `app/admin/emails/page.tsx` — client page (tiles, filter, refresh, table, badges).
- Modify `app/admin/layout.tsx` — add "Emails" nav tab.

---

## Task 1: Pure helpers — status derivation + type labels

**Files:**
- Create: `lib/email-status.ts`
- Test: `lib/__tests__/email-status.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/__tests__/email-status.test.ts
import { deriveEmailStatus, emailTypeLabel, EMAIL_STATUS_META } from '@/lib/email-status'

describe('deriveEmailStatus', () => {
  it('prioritizes failed over everything', () => {
    expect(deriveEmailStatus({ status: 'failed', openedAt: new Date(), bouncedAt: null })).toBe('failed')
  })
  it('reports bounced from bouncedAt or status', () => {
    expect(deriveEmailStatus({ status: 'sent', openedAt: null, bouncedAt: new Date() })).toBe('bounced')
    expect(deriveEmailStatus({ status: 'bounced', openedAt: null, bouncedAt: null })).toBe('bounced')
  })
  it('reports spam complaints', () => {
    expect(deriveEmailStatus({ status: 'complained', openedAt: null, bouncedAt: null })).toBe('complained')
  })
  it('reports opened when openedAt is set (and not bounced)', () => {
    expect(deriveEmailStatus({ status: 'delivered', openedAt: new Date(), bouncedAt: null })).toBe('opened')
  })
  it('reports delivered from status', () => {
    expect(deriveEmailStatus({ status: 'delivered', openedAt: null, bouncedAt: null })).toBe('delivered')
  })
  it('falls back to sent (pending)', () => {
    expect(deriveEmailStatus({ status: 'sent', openedAt: null, bouncedAt: null })).toBe('sent')
    expect(deriveEmailStatus({ status: null, openedAt: null, bouncedAt: null })).toBe('sent')
  })
})

describe('emailTypeLabel', () => {
  it('maps known raw types to friendly labels', () => {
    expect(emailTypeLabel('gated_rsvp_yes')).toBe('RSVP Yes')
    expect(emailTypeLabel('gated_rsvp_over_count')).toBe('Incorrect RSVP')
    expect(emailTypeLabel('save_the_date')).toBe('Save-the-Date')
    expect(emailTypeLabel('rsvp_notification')).toBe('New-RSVP alert (to you)')
  })
  it('falls back to the raw type, and to "Other" for null', () => {
    expect(emailTypeLabel('some_new_type')).toBe('some_new_type')
    expect(emailTypeLabel(null)).toBe('Other')
  })
})

it('EMAIL_STATUS_META covers every status with a label + className', () => {
  for (const k of ['failed', 'bounced', 'complained', 'opened', 'delivered', 'sent'] as const) {
    expect(EMAIL_STATUS_META[k].label).toBeTruthy()
    expect(EMAIL_STATUS_META[k].className).toContain('bg-')
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nvm use 22 && npx jest lib/__tests__/email-status.test.ts`
Expected: FAIL — cannot find module `@/lib/email-status`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/email-status.ts

export type EmailRowStatus = 'failed' | 'bounced' | 'complained' | 'opened' | 'delivered' | 'sent'

export interface EmailStatusInput {
  status: string | null
  openedAt: Date | string | null
  bouncedAt: Date | string | null
}

// First match wins. A bounce/failure is terminal, so it outranks an open; an open
// implies delivery. Anything unconfirmed is "sent (pending)".
export function deriveEmailStatus(row: EmailStatusInput): EmailRowStatus {
  if (row.status === 'failed') return 'failed'
  if (row.bouncedAt != null || row.status === 'bounced') return 'bounced'
  if (row.status === 'complained') return 'complained'
  if (row.openedAt != null) return 'opened'
  if (row.status === 'delivered') return 'delivered'
  return 'sent'
}

const TYPE_LABELS: Record<string, string> = {
  gated_rsvp_yes: 'RSVP Yes',
  gated_rsvp_no: 'RSVP No',
  gated_rsvp_over_count: 'Incorrect RSVP',
  gated_venue_details: 'Venue Details',
  gated_gracious_regrets: 'Gracious Regrets',
  save_the_date: 'Save-the-Date',
  save_the_date_confirmation: 'Save-the-Date Confirmation',
  registry_thank_you: 'Registry Thank-You',
  rsvp_notification: 'New-RSVP alert (to you)',
  blocked_attempt_notification: 'Blocked attempt (to you)',
}

export function emailTypeLabel(type: string | null): string {
  if (!type) return 'Other'
  return TYPE_LABELS[type] ?? type
}

export const EMAIL_STATUS_META: Record<EmailRowStatus, { label: string; className: string }> = {
  failed: { label: 'Failed to send', className: 'bg-gray-200 text-gray-700' },
  bounced: { label: 'Bounced', className: 'bg-red-100 text-red-800' },
  complained: { label: 'Marked as spam', className: 'bg-orange-100 text-orange-800' },
  opened: { label: 'Opened', className: 'bg-green-100 text-green-800' },
  delivered: { label: 'Delivered', className: 'bg-blue-100 text-blue-800' },
  sent: { label: 'Sent', className: 'bg-gray-100 text-gray-600' },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `nvm use 22 && npx jest lib/__tests__/email-status.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/email-status.ts lib/__tests__/email-status.test.ts
git commit -m "feat(email): shared email-status helpers (derived status, type labels)"
```

---

## Task 2: Rewrite the stats endpoint (six correct tiles)

**Files:**
- Modify: `app/api/admin/email/stats/route.ts` (full rewrite)
- Test: `app/api/admin/email/__tests__/stats-route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/api/admin/email/__tests__/stats-route.test.ts
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { emailLog: { count: jest.fn() } } }))

import { getServerSession } from 'next-auth'
import { GET } from '../stats/route'
import { prisma } from '@/lib/prisma'

const req = () => ({ url: 'http://x' }) as never

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
})

it('401s non-admin', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  const res = (await GET(req())) as { status: number }
  expect(res.status).toBe(401)
})

it('computes the six tiles with a correct open rate', async () => {
  // count() call order: total, failed, delivered, opened, bounced, complained
  ;(prisma.emailLog.count as jest.Mock)
    .mockResolvedValueOnce(100) // total
    .mockResolvedValueOnce(4)   // failed
    .mockResolvedValueOnce(80)  // delivered (status delivered OR opened)
    .mockResolvedValueOnce(40)  // opened
    .mockResolvedValueOnce(6)   // bounced
    .mockResolvedValueOnce(2)   // complained
  const res = (await GET(req())) as { body: Record<string, number> }
  expect(res.body).toEqual({ sent: 96, delivered: 80, opened: 40, openRate: 50, bounced: 6, failed: 4, complained: 2 })
})

it('reports a 0 open rate when nothing is delivered (no divide-by-zero)', async () => {
  ;(prisma.emailLog.count as jest.Mock)
    .mockResolvedValueOnce(3).mockResolvedValueOnce(3) // total, failed
    .mockResolvedValueOnce(0).mockResolvedValueOnce(0) // delivered, opened
    .mockResolvedValueOnce(0).mockResolvedValueOnce(0) // bounced, complained
  const res = (await GET(req())) as { body: Record<string, number> }
  expect(res.body.openRate).toBe(0)
  expect(res.body.sent).toBe(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nvm use 22 && npx jest app/api/admin/email/__tests__/stats-route.test.ts`
Expected: FAIL — current route returns `{ totalSent, delivered, opened, failed }`, not the new shape.

- [ ] **Step 3: Write the implementation**

```ts
// app/api/admin/email/stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Order matters — the tests assert this call sequence.
    const [total, failed, delivered, opened, bounced, complained] = await Promise.all([
      prisma.emailLog.count(),
      prisma.emailLog.count({ where: { status: 'failed' } }),
      prisma.emailLog.count({ where: { OR: [{ status: 'delivered' }, { openedAt: { not: null } }] } }),
      prisma.emailLog.count({ where: { openedAt: { not: null } } }),
      prisma.emailLog.count({ where: { bouncedAt: { not: null } } }),
      prisma.emailLog.count({ where: { status: 'complained' } }),
    ])

    const sent = total - failed
    const openRate = delivered > 0 ? Math.round((opened / delivered) * 100) : 0

    return NextResponse.json({ sent, delivered, opened, openRate, bounced, failed, complained })
  } catch (error) {
    console.error('Error fetching email stats:', error)
    return NextResponse.json({ error: 'Failed to fetch email statistics' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `nvm use 22 && npx jest app/api/admin/email/__tests__/stats-route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/email/stats/route.ts app/api/admin/email/__tests__/stats-route.test.ts
git commit -m "fix(email): stats endpoint returns six correct deliverability tiles"
```

---

## Task 3: List endpoint (newest 500, `?type=` filter)

**Files:**
- Create: `app/api/admin/emails/route.ts`
- Test: `app/api/admin/emails/__tests__/list-route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/api/admin/emails/__tests__/list-route.test.ts
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { emailLog: { findMany: jest.fn(), count: jest.fn() } } }))

import { getServerSession } from 'next-auth'
import { GET } from '../route'
import { prisma } from '@/lib/prisma'

const req = (url = 'http://x/api/admin/emails') => ({ url }) as never

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
  ;(prisma.emailLog.count as jest.Mock).mockResolvedValue(2)
  ;(prisma.emailLog.findMany as jest.Mock).mockResolvedValue([
    { id: '1', recipientEmail: 'a@x.com', emailType: 'gated_rsvp_yes', subject: 'S', sentAt: new Date('2026-07-18'),
      status: 'delivered', openedAt: null, bouncedAt: null, clickedAt: null,
      guest: { firstName: 'Ann', lastName: 'Lee' } },
    { id: '2', recipientEmail: 'b@x.com', emailType: 'save_the_date', subject: 'T', sentAt: new Date('2026-07-17'),
      status: 'sent', openedAt: null, bouncedAt: null, clickedAt: null, guest: null },
  ])
})

it('401s non-admin', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  const res = (await GET(req())) as { status: number }
  expect(res.status).toBe(401)
})

it('returns rows newest-first with guestName, total, and capped flag', async () => {
  const res = (await GET(req())) as { body: { emails: any[]; total: number; capped: boolean } }
  expect(prisma.emailLog.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ orderBy: { sentAt: 'desc' }, take: 500, where: {} })
  )
  expect(res.body.total).toBe(2)
  expect(res.body.capped).toBe(false)
  expect(res.body.emails[0].guestName).toBe('Ann Lee')
  expect(res.body.emails[1].guestName).toBeNull()
})

it('filters by ?type= (exact emailType)', async () => {
  await GET(req('http://x/api/admin/emails?type=gated_rsvp_yes'))
  expect(prisma.emailLog.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { emailType: 'gated_rsvp_yes' } })
  )
  expect(prisma.emailLog.count).toHaveBeenCalledWith({ where: { emailType: 'gated_rsvp_yes' } })
})

it('flags capped when total exceeds the cap', async () => {
  ;(prisma.emailLog.count as jest.Mock).mockResolvedValue(750)
  const res = (await GET(req())) as { body: { capped: boolean } }
  expect(res.body.capped).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nvm use 22 && npx jest app/api/admin/emails/__tests__/list-route.test.ts`
Expected: FAIL — cannot find module `../route`.

- [ ] **Step 3: Write the implementation**

```ts
// app/api/admin/emails/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const CAP = 500

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const type = new URL(request.url).searchParams.get('type')
    const where = type ? { emailType: type } : {}

    const [rows, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take: CAP,
        select: {
          id: true, recipientEmail: true, emailType: true, subject: true,
          sentAt: true, status: true, openedAt: true, bouncedAt: true, clickedAt: true,
          guest: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.emailLog.count({ where }),
    ])

    const emails = rows.map((r) => ({
      id: r.id,
      recipientEmail: r.recipientEmail,
      emailType: r.emailType,
      subject: r.subject,
      sentAt: r.sentAt,
      status: r.status,
      openedAt: r.openedAt,
      bouncedAt: r.bouncedAt,
      clickedAt: r.clickedAt,
      guestName: r.guest ? `${r.guest.firstName} ${r.guest.lastName}`.trim() : null,
    }))

    return NextResponse.json({ emails, total, capped: total > CAP })
  } catch (error) {
    console.error('Error fetching emails:', error)
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `nvm use 22 && npx jest app/api/admin/emails/__tests__/list-route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/emails/route.ts app/api/admin/emails/__tests__/list-route.test.ts
git commit -m "feat(email): admin emails list endpoint (newest 500, type filter)"
```

---

## Task 4: The `/admin/emails` page (tiles, filter, refresh, table)

**Files:**
- Create: `app/admin/emails/page.tsx`

> This is a client page verified by build + preview rather than a jest unit test (it renders behind the admin auth guard). Its logic (status derivation, labels) is already unit-tested in Task 1.

- [ ] **Step 1: Write the page**

```tsx
// app/admin/emails/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { deriveEmailStatus, emailTypeLabel, EMAIL_STATUS_META } from '@/lib/email-status'

interface EmailRow {
  id: string
  recipientEmail: string
  emailType: string | null
  subject: string | null
  sentAt: string
  status: string | null
  openedAt: string | null
  bouncedAt: string | null
  clickedAt: string | null
  guestName: string | null
}

interface Stats {
  sent: number; delivered: number; opened: number; openRate: number
  bounced: number; failed: number; complained: number
}

const TILES: Array<{ key: keyof Stats; label: string }> = [
  { key: 'sent', label: 'Sent' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'opened', label: 'Opened' },
  { key: 'bounced', label: 'Bounced' },
  { key: 'failed', label: 'Failed' },
  { key: 'complained', label: 'Spam' },
]

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Denver',
  })
}

export default function EmailsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [emails, setEmails] = useState<EmailRow[]>([])
  const [capped, setCapped] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState('')

  const load = useCallback(async (type: string) => {
    setLoading(true)
    setError('')
    try {
      const q = type ? `?type=${encodeURIComponent(type)}` : ''
      const [sRes, eRes] = await Promise.all([
        fetch('/api/admin/email/stats'),
        fetch(`/api/admin/emails${q}`),
      ])
      if (!sRes.ok || !eRes.ok) throw new Error('load failed')
      const s = await sRes.json()
      const e = await eRes.json()
      setStats(s)
      setEmails(e.emails)
      setCapped(e.capped)
      setUpdatedAt(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
    } catch {
      // Keep the currently-shown data; just surface a friendly message.
      setError("Couldn't load the latest email data. Try Refresh.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(typeFilter) }, [load, typeFilter])

  // Distinct types present, for the filter dropdown.
  const types = Array.from(new Set(emails.map((e) => e.emailType).filter(Boolean))) as string[]

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-[#00330a]">Emails</h1>
        <div className="flex items-center gap-3">
          {updatedAt && <span className="text-sm text-gray-500">Updated {updatedAt}</span>}
          <button
            onClick={() => load(typeFilter)}
            disabled={loading}
            className="px-4 py-2 rounded bg-[#00330a] text-white text-sm disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 text-sm text-red-700 bg-red-50 rounded px-3 py-2">{error}</div>}

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {TILES.map(({ key, label }) => (
          <div key={key} className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-[#00330a]">{stats ? stats[key] : '—'}</div>
            <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
            {key === 'opened' && stats && (
              <div className="text-xs text-gray-500 mt-1">{stats.openRate}% open rate</div>
            )}
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-3">
        <label className="text-sm text-gray-600">Filter by type</label>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
        >
          <option value="">All types</option>
          {types.map((t) => <option key={t} value={t}>{emailTypeLabel(t)}</option>)}
        </select>
        {capped && <span className="text-xs text-gray-500">Showing the latest 500</span>}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Recipient', 'Type', 'Subject', 'Sent', 'Status'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {emails.map((e) => {
              const st = deriveEmailStatus(e)
              const meta = EMAIL_STATUS_META[st]
              return (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {e.guestName && <div className="font-medium">{e.guestName}</div>}
                    <div className="text-gray-500">{e.recipientEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{emailTypeLabel(e.emailType)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{e.subject ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{fmtDate(e.sentAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs ${meta.className}`}>{meta.label}</span>
                  </td>
                </tr>
              )
            })}
            {emails.length === 0 && !loading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">No emails yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build to verify it compiles**

Run: `nvm use 22 && npx next build 2>&1 | grep -E "admin/emails|error|Compiled successfully"`
Expected: `✓ Compiled successfully` and an `/admin/emails` entry in the route list; no errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/emails/page.tsx
git commit -m "feat(email): /admin/emails page with tiles, type filter, refresh, status table"
```

---

## Task 5: Nav tab + full verification

**Files:**
- Modify: `app/admin/layout.tsx` (add nav link after "To Review")

- [ ] **Step 1: Add the nav tab**

In `app/admin/layout.tsx`, find the nav-links array (currently contains Dashboard, Guest Management, To Review) and add an Emails entry after To Review:

```tsx
  { label: 'Dashboard', href: '/admin' },
  { label: 'Guest Management', href: '/admin/guests' },
  { label: 'To Review', href: '/admin/review' },
  { label: 'Emails', href: '/admin/emails' },
```

- [ ] **Step 2: Run the full test suite**

Run: `nvm use 22 && npx jest 2>&1 | tail -4`
Expected: all suites pass (existing + the 3 new suites from Tasks 1–3).

- [ ] **Step 3: Production build**

Run: `nvm use 22 && npx next build 2>&1 | tail -20`
Expected: `✓ Compiled successfully`; `/admin/emails` listed as a route.

- [ ] **Step 4: Preview smoke (auth-gated)**

Start the dev server (`dev-node22` launch config) and confirm `/admin/emails` redirects to login when unauthenticated (302 → `/auth/login`) and that the dev-server log shows the page module compiling without error. Full visual verification requires an admin login (do not enter credentials automatically) — hand to Whitney/Nicolle for the logged-in check.

- [ ] **Step 5: Commit**

```bash
git add app/admin/layout.tsx
git commit -m "feat(email): add Emails tab to admin nav"
```

---

## Post-implementation: Resend config (no code — Whitney/Connor)

For opens/bounces/deliveries to populate, in the Resend dashboard:
1. Register webhook `https://walters-pierce-wedding.com/api/webhooks/resend` for `email.delivered`, `email.opened`, `email.bounced`, `email.complained`.
2. Set `RESEND_WEBHOOK_SECRET` (the endpoint signing secret) in Railway.
3. Enable **Open Tracking**.

Diagnostic (safe): `curl -s -o /dev/null -w "%{http_code}\n" -X POST https://walters-pierce-wedding.com/api/webhooks/resend` → **503** means `RESEND_WEBHOOK_SECRET` is unset; **400** (invalid signature) means it IS set. **Backfill caveat:** only emails sent after config is live get tracking; older `EmailLog` rows show "Sent".

---

## Self-Review

- **Spec coverage:** scope=all-sends-with-filter (Task 3 `?type=` + Task 4 dropdown ✓); six tiles (Task 2 ✓); refresh button (Task 4 ✓); derived status badges (Tasks 1 + 4 ✓); nav tab (Task 5 ✓); stats fix (Task 2 ✓); config documented (post-impl ✓); no schema change (confirmed — none in plan ✓). Out-of-scope items (clicks/CSV/drilldown/date filters) correctly absent.
- **Placeholders:** none — every code/test step contains full content.
- **Type consistency:** `deriveEmailStatus`/`emailTypeLabel`/`EMAIL_STATUS_META` defined in Task 1 and consumed with identical signatures in Task 4; stats shape `{sent,delivered,opened,openRate,bounced,failed,complained}` produced in Task 2 and consumed by the `Stats` interface + `TILES` in Task 4; list shape (incl. `guestName`, `capped`) produced in Task 3 and consumed by `EmailRow`/state in Task 4.
