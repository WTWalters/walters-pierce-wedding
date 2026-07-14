# Guest Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public `/photos` gallery where guests upload photos (signed direct-to-Cloudinary), like, and comment — live instantly, with reactive admin moderation at `/admin/photos`.

**Architecture:** Files upload from the guest's phone straight to Cloudinary using short-lived signatures minted by our API; the server only stores metadata. Photos/comments are visible unless `isHidden`; admins hide (soft) or delete (Cloudinary destroy + DB). Device identity (name + random UUID) lives in localStorage.

**Tech Stack:** Next.js 15 App Router, Prisma/PostgreSQL, `cloudinary` npm SDK (server-side only), Zod, Jest (babel-jest, mocked `next/server`), Tailwind with the wedding palette (green `#00330a`, gold `#D4AF37`, cream `#fdfcfb`).

**Spec:** `docs/superpowers/specs/2026-07-13-guest-photos-design.md`

**Branch:** work on `feature/guest-photos`. If using a worktree, put it under `.worktrees/` (NOT `.claude/` — jest ignores that path and tests will silently not run).

**One deviation from spec:** client-side file cap is **10MB, not 15MB** — Cloudinary's free tier rejects images over 10MB, so a 15MB cap would promise what the backend can't accept.

---

## File Map

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | + `PhotoLike` model, + `isHidden` on Photo/PhotoComment, `authorEmail` → optional |
| `lib/cloudinary.ts` | SDK config, `isCloudinaryConfigured`, `signUploadParams`, `verifyGuestPhoto`, `destroyPhoto`, `photoUrls` |
| `lib/rate-limit.ts` | tiny in-memory per-key throttle (pattern: `loginAttempts` in `lib/auth.ts`) |
| `scripts/setup-cloudinary-preset.mjs` | one-time: create signed upload preset `guest-photos-signed` |
| `app/api/photos/sign/route.ts` | POST — mint upload signature (503 when unconfigured, throttled) |
| `app/api/photos/route.ts` | GET — visible photos w/ likes+comments; POST — record uploaded photo |
| `app/api/photos/[id]/like/route.ts` | POST — toggle like per device |
| `app/api/photos/[id]/comments/route.ts` | POST — add comment |
| `app/api/admin/photos/route.ts` | GET — all photos incl. hidden (admin) |
| `app/api/admin/photos/[id]/route.ts` | PATCH hide/unhide, DELETE (Cloudinary + DB) |
| `app/api/admin/photos/[id]/comments/[commentId]/route.ts` | PATCH hide/unhide, DELETE comment |
| `components/photos/identity.ts` | localStorage name + deviceId helpers (client) |
| `app/(public)/photos/page.tsx` | public gallery + upload UI |
| `app/admin/photos/page.tsx` | admin moderation grid |
| `app/page.tsx` | footer nav + hero link to `/photos` |
| `scripts/generate-photos-qr.py` | branded table-QR generator → `assets/photos-qr/` |

Route tests live next to routes in `__tests__/` dirs (repo convention, e.g. `app/api/rsvp/__tests__/submit-route.test.ts`); lib tests in `lib/__tests__/`.

---

### Task 1: Schema migration — PhotoLike, isHidden, optional authorEmail

**Files:**
- Modify: `prisma/schema.prisma`
- Migration: `prisma/migrations/<timestamp>_guest_photos/`

- [ ] **Step 1: Edit schema**

In `model Photo` (line ~110), add after `viewCount`:

```prisma
  isHidden           Boolean        @default(false) @map("is_hidden")
```

and after `comments PhotoComment[]`:

```prisma
  likes              PhotoLike[]
```

In `model PhotoComment`, change `authorEmail String @map("author_email")` to:

```prisma
  authorEmail  String?   @map("author_email")
```

and add after `isApproved`:

```prisma
  isHidden     Boolean   @default(false) @map("is_hidden")
```

Add a new model after `PhotoComment`:

```prisma
model PhotoLike {
  id        String   @id @default(uuid()) @db.Uuid
  photoId   String   @map("photo_id") @db.Uuid
  deviceId  String   @map("device_id")
  createdAt DateTime @default(now()) @map("created_at")
  photo     Photo    @relation(fields: [photoId], references: [id], onDelete: Cascade)

  @@unique([photoId, deviceId])
  @@map("photo_likes")
}
```

- [ ] **Step 2: Generate migration against local dev DB**

Run: `npx prisma migrate dev --name guest_photos`
Expected: new folder under `prisma/migrations/`, `Your database is now in sync`. Open the generated SQL and confirm it's only: `ALTER TABLE photos ADD COLUMN is_hidden`, `ALTER TABLE photo_comments ADD COLUMN is_hidden`, `ALTER TABLE photo_comments ALTER COLUMN author_email DROP NOT NULL`, `CREATE TABLE photo_likes ...` — all safe/idempotent against prod (these tables exist in prod but are empty; Railway runs `migrate deploy` on push).

- [ ] **Step 3: Verify client generates**

Run: `npx prisma generate && npx tsc --noEmit 2>&1 | head -20`
Expected: generate succeeds; tsc shows only the 5 known pre-existing errors, nothing new.

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(photos): schema — photo_likes table, isHidden flags, optional comment email"
```

---

### Task 2: `lib/rate-limit.ts` — in-memory throttle

**Files:**
- Create: `lib/rate-limit.ts`
- Test: `lib/__tests__/rate-limit.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/__tests__/rate-limit.test.ts
import { checkRateLimit, __resetRateLimits } from '@/lib/rate-limit'

beforeEach(() => __resetRateLimits())

it('allows up to the limit within the window', () => {
  for (let i = 0; i < 30; i++) {
    expect(checkRateLimit('1.2.3.4', 30, 60_000)).toBe(true)
  }
  expect(checkRateLimit('1.2.3.4', 30, 60_000)).toBe(false)
})

it('tracks keys independently', () => {
  for (let i = 0; i < 30; i++) checkRateLimit('a', 30, 60_000)
  expect(checkRateLimit('a', 30, 60_000)).toBe(false)
  expect(checkRateLimit('b', 30, 60_000)).toBe(true)
})

it('resets after the window elapses', () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000)
  for (let i = 0; i < 30; i++) checkRateLimit('x', 30, 60_000)
  expect(checkRateLimit('x', 30, 60_000)).toBe(false)
  now.mockReturnValue(1_000_000 + 60_001)
  expect(checkRateLimit('x', 30, 60_000)).toBe(true)
  now.mockRestore()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/__tests__/rate-limit.test.ts`
Expected: FAIL — cannot find module `@/lib/rate-limit`

- [ ] **Step 3: Implement**

```typescript
// lib/rate-limit.ts
// In-memory per-key throttle. Same conscious trade-off as loginAttempts in
// lib/auth.ts: resets on deploy/restart, single-instance only — acceptable
// for a single-dyno wedding site.
const buckets = new Map<string, { count: number; windowStart: number }>()

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now })
    return true
  }
  bucket.count++
  return bucket.count <= limit
}

export function __resetRateLimits() {
  buckets.clear()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/__tests__/rate-limit.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add lib/rate-limit.ts lib/__tests__/rate-limit.test.ts
git commit -m "feat(photos): in-memory rate limiter for public endpoints"
```

---

### Task 3: `lib/cloudinary.ts` — SDK wrapper

**Files:**
- Create: `lib/cloudinary.ts`
- Test: `lib/__tests__/cloudinary.test.ts`

- [ ] **Step 1: Install SDK**

Run: `npm install cloudinary`
Expected: added to dependencies (v2.x).

- [ ] **Step 2: Write the failing test**

```typescript
// lib/__tests__/cloudinary.test.ts
const mockApiSignRequest = jest.fn().mockReturnValue('sig123')
const mockResource = jest.fn()
const mockDestroy = jest.fn()

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    utils: { api_sign_request: (...a: unknown[]) => mockApiSignRequest(...a) },
    api: { resource: (...a: unknown[]) => mockResource(...a) },
    uploader: { destroy: (...a: unknown[]) => mockDestroy(...a) },
  },
}))

describe('with env configured', () => {
  let cl: typeof import('@/lib/cloudinary')
  beforeEach(() => {
    jest.resetModules()
    process.env.CLOUDINARY_CLOUD_NAME = 'testcloud'
    process.env.CLOUDINARY_API_KEY = 'key'
    process.env.CLOUDINARY_API_SECRET = 'secret'
    cl = require('@/lib/cloudinary')
  })

  it('isCloudinaryConfigured is true', () => {
    expect(cl.isCloudinaryConfigured()).toBe(true)
  })

  it('signUploadParams signs timestamp+preset+folder', () => {
    const p = cl.signUploadParams()
    expect(p).toMatchObject({
      cloudName: 'testcloud',
      apiKey: 'key',
      uploadPreset: 'guest-photos-signed',
      folder: 'guest-photos',
      signature: 'sig123',
    })
    expect(typeof p.timestamp).toBe('number')
    expect(mockApiSignRequest).toHaveBeenCalledWith(
      { timestamp: p.timestamp, upload_preset: 'guest-photos-signed', folder: 'guest-photos' },
      'secret'
    )
  })

  it('verifyGuestPhoto accepts assets under guest-photos/', async () => {
    mockResource.mockResolvedValue({ secure_url: 'https://res.cloudinary.com/x.jpg' })
    await expect(cl.verifyGuestPhoto('guest-photos/abc')).resolves.toEqual({
      secureUrl: 'https://res.cloudinary.com/x.jpg',
    })
  })

  it('verifyGuestPhoto rejects folder escapes without calling the API', async () => {
    await expect(cl.verifyGuestPhoto('other/abc')).resolves.toBeNull()
    expect(mockResource).not.toHaveBeenCalled()
  })

  it('verifyGuestPhoto returns null when the asset does not exist', async () => {
    mockResource.mockRejectedValue(new Error('not found'))
    await expect(cl.verifyGuestPhoto('guest-photos/missing')).resolves.toBeNull()
  })

  it('photoUrls builds full + thumbnail delivery URLs', () => {
    expect(cl.photoUrls('guest-photos/abc')).toEqual({
      fileUrl: 'https://res.cloudinary.com/testcloud/image/upload/f_auto,q_auto/guest-photos/abc',
      thumbnailUrl: 'https://res.cloudinary.com/testcloud/image/upload/w_600,f_auto,q_auto/guest-photos/abc',
    })
  })
})

describe('without env', () => {
  it('isCloudinaryConfigured is false', () => {
    jest.resetModules()
    delete process.env.CLOUDINARY_CLOUD_NAME
    delete process.env.CLOUDINARY_API_KEY
    delete process.env.CLOUDINARY_API_SECRET
    const cl = require('@/lib/cloudinary')
    expect(cl.isCloudinaryConfigured()).toBe(false)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest lib/__tests__/cloudinary.test.ts`
Expected: FAIL — cannot find module `@/lib/cloudinary`

- [ ] **Step 4: Implement**

```typescript
// lib/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary'

export const GUEST_PHOTOS_FOLDER = 'guest-photos'
export const UPLOAD_PRESET = 'guest-photos-signed'

const cloudName = process.env.CLOUDINARY_CLOUD_NAME
const apiKey = process.env.CLOUDINARY_API_KEY
const apiSecret = process.env.CLOUDINARY_API_SECRET

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret })
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(cloudName && apiKey && apiSecret)
}

// Params the browser needs to upload directly to Cloudinary. The signature
// covers exactly the params the client will send (timestamp, preset, folder);
// Cloudinary rejects stale timestamps (~1h), so signatures are short-lived.
export function signUploadParams() {
  const timestamp = Math.round(Date.now() / 1000)
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, upload_preset: UPLOAD_PRESET, folder: GUEST_PHOTOS_FOLDER },
    apiSecret as string
  )
  return { cloudName, apiKey, timestamp, signature, uploadPreset: UPLOAD_PRESET, folder: GUEST_PHOTOS_FOLDER }
}

// A photo record may only be created for an asset that really exists in our
// account under guest-photos/ — otherwise anyone could POST arbitrary URLs.
export async function verifyGuestPhoto(publicId: string): Promise<{ secureUrl: string } | null> {
  if (!publicId.startsWith(`${GUEST_PHOTOS_FOLDER}/`)) return null
  try {
    const res = await cloudinary.api.resource(publicId)
    return { secureUrl: res.secure_url }
  } catch {
    return null
  }
}

export async function destroyPhoto(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId)
}

export function photoUrls(publicId: string) {
  const base = `https://res.cloudinary.com/${cloudName}/image/upload`
  return {
    fileUrl: `${base}/f_auto,q_auto/${publicId}`,
    thumbnailUrl: `${base}/w_600,f_auto,q_auto/${publicId}`,
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest lib/__tests__/cloudinary.test.ts`
Expected: 7 passed

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/cloudinary.ts lib/__tests__/cloudinary.test.ts
git commit -m "feat(photos): cloudinary wrapper — signing, asset verify, destroy, delivery URLs"
```

---

### Task 4: One-time preset setup script

**Files:**
- Create: `scripts/setup-cloudinary-preset.mjs`

- [ ] **Step 1: Write the script**

```javascript
// scripts/setup-cloudinary-preset.mjs
// One-time (idempotent): creates the signed upload preset used by /photos.
// Run: node scripts/setup-cloudinary-preset.mjs
import { v2 as cloudinary } from 'cloudinary'
import { config } from 'dotenv'
config({ path: '.env.local' })

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const NAME = 'guest-photos-signed'
const settings = {
  unsigned: false,
  folder: 'guest-photos',
  allowed_formats: 'jpg,jpeg,png,gif,webp,heic,heif,avif',
  overwrite: false,
  unique_filename: true,
}

try {
  await cloudinary.api.create_upload_preset({ name: NAME, ...settings })
  console.log(`Created preset ${NAME}`)
} catch (err) {
  if (String(err?.error?.message ?? err).includes('already exists')) {
    await cloudinary.api.update_upload_preset(NAME, settings)
    console.log(`Preset ${NAME} already existed — settings re-applied`)
  } else {
    throw err
  }
}
```

- [ ] **Step 2: Run it against the real account**

Run: `node scripts/setup-cloudinary-preset.mjs`
Expected: `Created preset guest-photos-signed` (or the re-applied message on re-run). Verify: `node -e "..."` is not needed — re-running the script must print the re-applied message (idempotency check).

- [ ] **Step 3: Commit**

```bash
git add scripts/setup-cloudinary-preset.mjs
git commit -m "chore(photos): idempotent script to create the signed Cloudinary upload preset"
```

---

### Task 5: `POST /api/photos/sign`

**Files:**
- Create: `app/api/photos/sign/route.ts`
- Test: `app/api/photos/__tests__/sign-route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/photos/__tests__/sign-route.test.ts
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}))
jest.mock('@/lib/cloudinary', () => ({
  isCloudinaryConfigured: jest.fn(),
  signUploadParams: jest.fn(),
}))
jest.mock('@/lib/rate-limit', () => ({ checkRateLimit: jest.fn() }))

import { POST } from '../sign/route'
import { isCloudinaryConfigured, signUploadParams } from '@/lib/cloudinary'
import { checkRateLimit } from '@/lib/rate-limit'

const makeRequest = (ip = '1.2.3.4') =>
  ({ headers: new Map([['x-forwarded-for', ip]]) }) as never

beforeEach(() => {
  jest.clearAllMocks()
  ;(isCloudinaryConfigured as jest.Mock).mockReturnValue(true)
  ;(checkRateLimit as jest.Mock).mockReturnValue(true)
  ;(signUploadParams as jest.Mock).mockReturnValue({ signature: 's', timestamp: 1 })
})

it('returns signing params', async () => {
  const res = (await POST(makeRequest())) as { body: Record<string, unknown>; status: number }
  expect(res.status).toBe(200)
  expect(res.body).toEqual({ signature: 's', timestamp: 1 })
})

it('503s when Cloudinary is unconfigured', async () => {
  ;(isCloudinaryConfigured as jest.Mock).mockReturnValue(false)
  const res = (await POST(makeRequest())) as { status: number }
  expect(res.status).toBe(503)
})

it('429s past the rate limit', async () => {
  ;(checkRateLimit as jest.Mock).mockReturnValue(false)
  const res = (await POST(makeRequest())) as { status: number }
  expect(res.status).toBe(429)
  expect(signUploadParams).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/photos/__tests__/sign-route.test.ts`
Expected: FAIL — cannot find `../sign/route`

- [ ] **Step 3: Implement**

```typescript
// app/api/photos/sign/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { isCloudinaryConfigured, signUploadParams } from '@/lib/cloudinary'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    if (!isCloudinaryConfigured()) {
      return NextResponse.json({ error: 'Photo uploads are not available yet' }, { status: 503 })
    }
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(`photo-sign:${ip}`, 30, 60 * 60 * 1000)) {
      return NextResponse.json({ error: 'Too many uploads — please wait a bit' }, { status: 429 })
    }
    return NextResponse.json(signUploadParams())
  } catch (error) {
    console.error('Error signing upload:', error)
    return NextResponse.json({ error: 'Failed to prepare upload' }, { status: 500 })
  }
}
```

Note: the test's `makeRequest` uses a `Map`, whose `.get` matches the `Headers.get` shape used here.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/photos/__tests__/sign-route.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add app/api/photos/sign/ app/api/photos/__tests__/sign-route.test.ts
git commit -m "feat(photos): signed-upload endpoint with per-IP throttle"
```

---

### Task 6: `GET /api/photos` + `POST /api/photos`

**Files:**
- Create: `app/api/photos/route.ts`
- Test: `app/api/photos/__tests__/photos-route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/photos/__tests__/photos-route.test.ts
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    photo: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  },
}))
jest.mock('@/lib/cloudinary', () => ({
  isCloudinaryConfigured: jest.fn().mockReturnValue(true),
  verifyGuestPhoto: jest.fn(),
  photoUrls: jest.fn().mockReturnValue({ fileUrl: 'F', thumbnailUrl: 'T' }),
}))

import { GET, POST } from '../route'
import { prisma } from '@/lib/prisma'
import { verifyGuestPhoto } from '@/lib/cloudinary'

const dbPhoto = {
  id: 'p1', uploadedByName: 'Ann', caption: null, fileUrl: 'F', thumbnailUrl: 'T',
  createdAt: new Date('2026-09-20'),
  likes: [{ deviceId: 'dev-1' }],
  comments: [{ id: 'c1', authorName: 'Bo', comment: 'hi', createdAt: new Date('2026-09-20') }],
}

const makeGet = (url: string) => ({ url }) as never
const makePost = (json: unknown) => ({ json: async () => json }) as never

beforeEach(() => jest.clearAllMocks())

describe('GET', () => {
  it('lists visible photos with like count and likedByMe', async () => {
    ;(prisma.photo.findMany as jest.Mock).mockResolvedValue([dbPhoto])
    const res = (await GET(makeGet('http://x/api/photos?deviceId=dev-1'))) as {
      body: { photos: Array<Record<string, unknown>> }
    }
    expect(prisma.photo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isHidden: false, category: 'guest' } })
    )
    expect(res.body.photos[0]).toMatchObject({ id: 'p1', likeCount: 1, likedByMe: true })
  })

  it('likedByMe is false for other devices', async () => {
    ;(prisma.photo.findMany as jest.Mock).mockResolvedValue([dbPhoto])
    const res = (await GET(makeGet('http://x/api/photos?deviceId=other'))) as {
      body: { photos: Array<Record<string, unknown>> }
    }
    expect(res.body.photos[0]).toMatchObject({ likeCount: 1, likedByMe: false })
  })
})

describe('POST', () => {
  const valid = { publicId: 'guest-photos/abc', name: 'Ann', caption: 'us!' }

  it('creates a photo after verifying the asset', async () => {
    ;(verifyGuestPhoto as jest.Mock).mockResolvedValue({ secureUrl: 'S' })
    ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.photo.create as jest.Mock).mockResolvedValue({ id: 'new' })
    const res = (await POST(makePost(valid))) as { body: Record<string, unknown>; status: number }
    expect(res.status).toBe(200)
    expect(prisma.photo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        category: 'guest', uploadedByName: 'Ann', caption: 'us!',
        cloudinaryPublicId: 'guest-photos/abc', fileUrl: 'F', thumbnailUrl: 'T',
        isApproved: true,
      }),
    })
  })

  it('422s when the asset cannot be verified', async () => {
    ;(verifyGuestPhoto as jest.Mock).mockResolvedValue(null)
    const res = (await POST(makePost(valid))) as { status: number }
    expect(res.status).toBe(422)
    expect(prisma.photo.create).not.toHaveBeenCalled()
  })

  it('409s on duplicate publicId', async () => {
    ;(verifyGuestPhoto as jest.Mock).mockResolvedValue({ secureUrl: 'S' })
    ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' })
    const res = (await POST(makePost(valid))) as { status: number }
    expect(res.status).toBe(409)
  })

  it('400s on validation failure (name too long)', async () => {
    const res = (await POST(makePost({ ...valid, name: 'x'.repeat(101) }))) as { status: number }
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/photos/__tests__/photos-route.test.ts`
Expected: FAIL — cannot find `../route`

- [ ] **Step 3: Implement**

```typescript
// app/api/photos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyGuestPhoto, photoUrls } from '@/lib/cloudinary'

const createSchema = z.object({
  publicId: z.string().min(1).max(300),
  name: z.string().trim().min(1).max(100),
  caption: z.string().trim().max(280).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const deviceId = new URL(request.url).searchParams.get('deviceId') ?? ''
    const photos = await prisma.photo.findMany({
      where: { isHidden: false, category: 'guest' },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        likes: { select: { deviceId: true } },
        comments: {
          where: { isHidden: false },
          orderBy: { createdAt: 'asc' },
          select: { id: true, authorName: true, comment: true, createdAt: true },
        },
      },
    })
    return NextResponse.json({
      photos: photos.map((p) => ({
        id: p.id,
        uploadedByName: p.uploadedByName,
        caption: p.caption,
        fileUrl: p.fileUrl,
        thumbnailUrl: p.thumbnailUrl,
        createdAt: p.createdAt,
        likeCount: p.likes.length,
        likedByMe: deviceId !== '' && p.likes.some((l) => l.deviceId === deviceId),
        comments: p.comments,
      })),
    })
  } catch (error) {
    console.error('Error fetching photos:', error)
    return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = createSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid photo details' }, { status: 400 })
    }
    const { publicId, name, caption } = parsed.data

    const verified = await verifyGuestPhoto(publicId)
    if (!verified) {
      return NextResponse.json({ error: 'Upload could not be verified' }, { status: 422 })
    }
    const existing = await prisma.photo.findFirst({ where: { cloudinaryPublicId: publicId } })
    if (existing) {
      return NextResponse.json({ error: 'Photo already added' }, { status: 409 })
    }
    const urls = photoUrls(publicId)
    const photo = await prisma.photo.create({
      data: {
        category: 'guest',
        uploadedByName: name,
        caption: caption || null,
        cloudinaryPublicId: publicId,
        fileUrl: urls.fileUrl,
        thumbnailUrl: urls.thumbnailUrl,
        // isApproved is legacy pre-gating machinery; photos are live unless
        // isHidden. Set true so any old isApproved-filtered query still works.
        isApproved: true,
      },
    })
    return NextResponse.json({ ok: true, id: photo.id })
  } catch (error) {
    console.error('Error creating photo:', error)
    return NextResponse.json({ error: 'Failed to save photo' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/photos/__tests__/photos-route.test.ts`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add app/api/photos/route.ts app/api/photos/__tests__/photos-route.test.ts
git commit -m "feat(photos): public list + create endpoints with asset verification"
```

---

### Task 7: `POST /api/photos/[id]/like` — toggle

**Files:**
- Create: `app/api/photos/[id]/like/route.ts`
- Test: `app/api/photos/__tests__/like-route.test.ts`

Next 15 gotcha (recorded in repo memory): dynamic-segment route handlers receive `params` as a **Promise** — `{ params }: { params: Promise<{ id: string }> }`.

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/photos/__tests__/like-route.test.ts
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}))
jest.mock('@prisma/client', () => {
  class MockPrismaClientKnownRequestError extends Error {
    code: string
    clientVersion: string
    constructor(message: string, opts: { code: string; clientVersion: string }) {
      super(message)
      this.code = opts.code
      this.clientVersion = opts.clientVersion
    }
  }
  return { Prisma: { PrismaClientKnownRequestError: MockPrismaClientKnownRequestError } }
})
jest.mock('@/lib/prisma', () => ({
  prisma: {
    photo: { findFirst: jest.fn() },
    photoLike: { create: jest.fn(), deleteMany: jest.fn(), count: jest.fn() },
  },
}))

import { Prisma } from '@prisma/client'
import { POST } from '../[id]/like/route'
import { prisma } from '@/lib/prisma'

const makeRequest = (json: unknown) => ({ json: async () => json }) as never
const ctx = { params: Promise.resolve({ id: 'p1' }) }

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue({ id: 'p1' })
  ;(prisma.photoLike.count as jest.Mock).mockResolvedValue(5)
})

it('likes when no existing like', async () => {
  ;(prisma.photoLike.create as jest.Mock).mockResolvedValue({})
  const res = (await POST(makeRequest({ deviceId: 'd1' }), ctx)) as { body: Record<string, unknown> }
  expect(res.body).toEqual({ liked: true, likeCount: 5 })
})

it('unlikes on P2002 (already liked)', async () => {
  ;(prisma.photoLike.create as jest.Mock).mockRejectedValue(
    new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' })
  )
  const res = (await POST(makeRequest({ deviceId: 'd1' }), ctx)) as { body: Record<string, unknown> }
  expect(prisma.photoLike.deleteMany).toHaveBeenCalledWith({
    where: { photoId: 'p1', deviceId: 'd1' },
  })
  expect(res.body).toEqual({ liked: false, likeCount: 5 })
})

it('404s for unknown or hidden photo', async () => {
  ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue(null)
  const res = (await POST(makeRequest({ deviceId: 'd1' }), ctx)) as { status: number }
  expect(res.status).toBe(404)
})

it('400s without deviceId', async () => {
  const res = (await POST(makeRequest({}), ctx)) as { status: number }
  expect(res.status).toBe(400)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/photos/__tests__/like-route.test.ts`
Expected: FAIL — cannot find `../[id]/like/route`

- [ ] **Step 3: Implement**

```typescript
// app/api/photos/[id]/like/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const likeSchema = z.object({ deviceId: z.string().min(8).max(64) })

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const parsed = likeSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const { deviceId } = parsed.data

    const photo = await prisma.photo.findFirst({ where: { id, isHidden: false } })
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    let liked: boolean
    try {
      await prisma.photoLike.create({ data: { photoId: id, deviceId } })
      liked = true
    } catch (error) {
      // Unique (photoId, deviceId) violation = this device already liked → toggle off
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        await prisma.photoLike.deleteMany({ where: { photoId: id, deviceId } })
        liked = false
      } else {
        throw error
      }
    }
    const likeCount = await prisma.photoLike.count({ where: { photoId: id } })
    return NextResponse.json({ liked, likeCount })
  } catch (error) {
    console.error('Error toggling like:', error)
    return NextResponse.json({ error: 'Failed to update like' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/photos/__tests__/like-route.test.ts`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add "app/api/photos/[id]/like/" app/api/photos/__tests__/like-route.test.ts
git commit -m "feat(photos): per-device like toggle with P2002-safe race handling"
```

---

### Task 8: `POST /api/photos/[id]/comments`

**Files:**
- Create: `app/api/photos/[id]/comments/route.ts`
- Test: `app/api/photos/__tests__/comments-route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/photos/__tests__/comments-route.test.ts
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    photo: { findFirst: jest.fn() },
    photoComment: { create: jest.fn() },
  },
}))

import { POST } from '../[id]/comments/route'
import { prisma } from '@/lib/prisma'

const makeRequest = (json: unknown) => ({ json: async () => json }) as never
const ctx = { params: Promise.resolve({ id: 'p1' }) }

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue({ id: 'p1' })
})

it('creates a visible comment', async () => {
  ;(prisma.photoComment.create as jest.Mock).mockResolvedValue({
    id: 'c1', authorName: 'Bo', comment: 'lovely', createdAt: new Date('2026-09-20'),
  })
  const res = (await POST(makeRequest({ name: 'Bo', comment: 'lovely' }), ctx)) as {
    body: Record<string, unknown>; status: number
  }
  expect(res.status).toBe(200)
  expect(prisma.photoComment.create).toHaveBeenCalledWith({
    data: { photoId: 'p1', authorName: 'Bo', comment: 'lovely', isApproved: true },
  })
  expect(res.body).toMatchObject({ comment: { id: 'c1', authorName: 'Bo' } })
})

it('404s for hidden/unknown photo', async () => {
  ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue(null)
  const res = (await POST(makeRequest({ name: 'Bo', comment: 'x' }), ctx)) as { status: number }
  expect(res.status).toBe(404)
})

it('400s on comment over 500 chars', async () => {
  const res = (await POST(makeRequest({ name: 'Bo', comment: 'x'.repeat(501) }), ctx)) as { status: number }
  expect(res.status).toBe(400)
})

it('400s on empty name', async () => {
  const res = (await POST(makeRequest({ name: '  ', comment: 'hi' }), ctx)) as { status: number }
  expect(res.status).toBe(400)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/photos/__tests__/comments-route.test.ts`
Expected: FAIL — cannot find `../[id]/comments/route`

- [ ] **Step 3: Implement**

```typescript
// app/api/photos/[id]/comments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const commentSchema = z.object({
  name: z.string().trim().min(1).max(100),
  comment: z.string().trim().min(1).max(500),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const parsed = commentSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid comment' }, { status: 400 })
    }
    const photo = await prisma.photo.findFirst({ where: { id, isHidden: false } })
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }
    const created = await prisma.photoComment.create({
      data: {
        photoId: id,
        authorName: parsed.data.name,
        comment: parsed.data.comment,
        // legacy pre-gating flag; comments are live unless isHidden
        isApproved: true,
      },
    })
    return NextResponse.json({
      comment: {
        id: created.id,
        authorName: created.authorName,
        comment: created.comment,
        createdAt: created.createdAt,
      },
    })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/photos/__tests__/comments-route.test.ts`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add "app/api/photos/[id]/comments/" app/api/photos/__tests__/comments-route.test.ts
git commit -m "feat(photos): guest comments endpoint"
```

---

### Task 9: Admin routes — list, hide/delete photo, hide/delete comment

**Files:**
- Create: `app/api/admin/photos/route.ts`
- Create: `app/api/admin/photos/[id]/route.ts`
- Create: `app/api/admin/photos/[id]/comments/[commentId]/route.ts`
- Test: `app/api/admin/photos/__tests__/admin-photos-routes.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/admin/photos/__tests__/admin-photos-routes.test.ts
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    photo: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    photoComment: { update: jest.fn(), delete: jest.fn() },
  },
}))
jest.mock('@/lib/cloudinary', () => ({ destroyPhoto: jest.fn() }))

import { getServerSession } from 'next-auth'
import { GET } from '../route'
import { PATCH, DELETE } from '../[id]/route'
import { PATCH as commentPatch, DELETE as commentDelete } from '../[id]/comments/[commentId]/route'
import { prisma } from '@/lib/prisma'
import { destroyPhoto } from '@/lib/cloudinary'

const admin = { user: { role: 'admin' } }
const makeRequest = (json: unknown = {}) => ({ json: async () => json, url: 'http://x' }) as never
const photoCtx = { params: Promise.resolve({ id: 'p1' }) }
const commentCtx = { params: Promise.resolve({ id: 'p1', commentId: 'c1' }) }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue(admin)
})

it('every route 401s without an admin session', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  for (const call of [
    () => GET(makeRequest()),
    () => PATCH(makeRequest({ isHidden: true }), photoCtx),
    () => DELETE(makeRequest(), photoCtx),
    () => commentPatch(makeRequest({ isHidden: true }), commentCtx),
    () => commentDelete(makeRequest(), commentCtx),
  ]) {
    const res = (await call()) as { status: number }
    expect(res.status).toBe(401)
  }
})

it('GET returns all guest photos including hidden', async () => {
  ;(prisma.photo.findMany as jest.Mock).mockResolvedValue([])
  await GET(makeRequest())
  expect(prisma.photo.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { category: 'guest' } })
  )
})

it('PATCH toggles isHidden', async () => {
  ;(prisma.photo.update as jest.Mock).mockResolvedValue({ id: 'p1', isHidden: true })
  const res = (await PATCH(makeRequest({ isHidden: true }), photoCtx)) as { status: number }
  expect(res.status).toBe(200)
  expect(prisma.photo.update).toHaveBeenCalledWith({
    where: { id: 'p1' }, data: { isHidden: true },
  })
})

it('DELETE destroys the Cloudinary asset then the row', async () => {
  ;(prisma.photo.findUnique as jest.Mock).mockResolvedValue({
    id: 'p1', cloudinaryPublicId: 'guest-photos/abc',
  })
  await DELETE(makeRequest(), photoCtx)
  expect(destroyPhoto).toHaveBeenCalledWith('guest-photos/abc')
  expect(prisma.photo.delete).toHaveBeenCalledWith({ where: { id: 'p1' } })
})

it('DELETE still deletes the row when there is no Cloudinary id', async () => {
  ;(prisma.photo.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', cloudinaryPublicId: null })
  await DELETE(makeRequest(), photoCtx)
  expect(destroyPhoto).not.toHaveBeenCalled()
  expect(prisma.photo.delete).toHaveBeenCalled()
})

it('comment PATCH and DELETE hit photoComment', async () => {
  ;(prisma.photoComment.update as jest.Mock).mockResolvedValue({})
  await commentPatch(makeRequest({ isHidden: true }), commentCtx)
  expect(prisma.photoComment.update).toHaveBeenCalledWith({
    where: { id: 'c1' }, data: { isHidden: true },
  })
  await commentDelete(makeRequest(), commentCtx)
  expect(prisma.photoComment.delete).toHaveBeenCalledWith({ where: { id: 'c1' } })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/admin/photos/__tests__/admin-photos-routes.test.ts`
Expected: FAIL — cannot find `../route`

- [ ] **Step 3: Implement all three route files**

```typescript
// app/api/admin/photos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const photos = await prisma.photo.findMany({
      where: { category: 'guest' },
      orderBy: { createdAt: 'desc' },
      include: {
        likes: { select: { deviceId: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, authorName: true, comment: true, createdAt: true, isHidden: true },
        },
      },
    })
    return NextResponse.json({
      photos: photos.map((p) => ({
        id: p.id,
        uploadedByName: p.uploadedByName,
        caption: p.caption,
        thumbnailUrl: p.thumbnailUrl,
        fileUrl: p.fileUrl,
        createdAt: p.createdAt,
        isHidden: p.isHidden,
        likeCount: p.likes.length,
        comments: p.comments,
      })),
    })
  } catch (error) {
    console.error('Error fetching admin photos:', error)
    return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 })
  }
}
```

```typescript
// app/api/admin/photos/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { destroyPhoto } from '@/lib/cloudinary'

const patchSchema = z.object({ isHidden: z.boolean() })

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const parsed = patchSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const photo = await prisma.photo.update({ where: { id }, data: { isHidden: parsed.data.isHidden } })
    return NextResponse.json({ ok: true, isHidden: photo.isHidden })
  } catch (error) {
    console.error('Error updating photo:', error)
    return NextResponse.json({ error: 'Failed to update photo' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const photo = await prisma.photo.findUnique({ where: { id } })
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }
    if (photo.cloudinaryPublicId) {
      await destroyPhoto(photo.cloudinaryPublicId)
    }
    await prisma.photo.delete({ where: { id } }) // cascades comments + likes
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting photo:', error)
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 })
  }
}
```

```typescript
// app/api/admin/photos/[id]/comments/[commentId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const patchSchema = z.object({ isHidden: z.boolean() })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { commentId } = await params
    const parsed = patchSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    await prisma.photoComment.update({ where: { id: commentId }, data: { isHidden: parsed.data.isHidden } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error updating comment:', error)
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { commentId } = await params
    await prisma.photoComment.delete({ where: { id: commentId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting comment:', error)
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/admin/photos/__tests__/admin-photos-routes.test.ts`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/photos/
git commit -m "feat(photos): admin moderation endpoints — list all, hide/unhide, delete"
```

---

### Task 10: Client identity helper

**Files:**
- Create: `components/photos/identity.ts`
- Test: `components/photos/__tests__/identity.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// components/photos/__tests__/identity.test.ts
import { getStoredName, setStoredName, getDeviceId } from '../identity'

beforeEach(() => localStorage.clear())

it('name round-trips through localStorage', () => {
  expect(getStoredName()).toBeNull()
  setStoredName('  Ann Walters  ')
  expect(getStoredName()).toBe('Ann Walters')
})

it('deviceId is generated once and stable', () => {
  const first = getDeviceId()
  expect(first).toMatch(/^[0-9a-f-]{36}$/)
  expect(getDeviceId()).toBe(first)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest components/photos/__tests__/identity.test.ts`
Expected: FAIL — cannot find module `../identity`

- [ ] **Step 3: Implement**

```typescript
// components/photos/identity.ts
// Client-only: device identity for the photos page. Name is asked once and
// remembered; deviceId anonymously scopes likes to this browser.
const NAME_KEY = 'photos.name'
const DEVICE_KEY = 'photos.deviceId'

export function getStoredName(): string | null {
  const name = localStorage.getItem(NAME_KEY)?.trim()
  return name ? name : null
}

export function setStoredName(name: string) {
  localStorage.setItem(NAME_KEY, name.trim())
}

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}
```

(jsdom in this repo supports `crypto.randomUUID`; jest env is jsdom per `jest.config.js`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest components/photos/__tests__/identity.test.ts`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add components/photos/
git commit -m "feat(photos): device identity helper (remembered name + anonymous deviceId)"
```

---

### Task 11: Public `/photos` page

**Files:**
- Create: `app/(public)/photos/page.tsx`

UI-only task (no unit test — repo convention is API-level tests; verification is the live smoke in Task 14). Match the site's look: Playfair Display headings, forest green `#00330a`, gold `#D4AF37`, cream background, same header/footer treatment as `app/(public)/rsvp/page.tsx`.

- [ ] **Step 1: Implement the page**

```tsx
// app/(public)/photos/page.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getStoredName, setStoredName, getDeviceId } from '@/components/photos/identity'

type Comment = { id: string; authorName: string; comment: string; createdAt: string }
type Photo = {
  id: string; uploadedByName: string | null; caption: string | null
  fileUrl: string; thumbnailUrl: string | null; createdAt: string
  likeCount: number; likedByMe: boolean; comments: Comment[]
}
type UploadItem = { key: string; fileName: string; status: 'uploading' | 'done' | 'error' }

const MAX_FILE_BYTES = 10 * 1024 * 1024 // Cloudinary free-tier image limit

export default function PhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState<string | null>(null)
  const [namePrompt, setNamePrompt] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [uploadsAvailable, setUploadsAvailable] = useState(true)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({})
  const fileInput = useRef<HTMLInputElement>(null)
  const pendingFiles = useRef<File[] | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/photos?deviceId=${getDeviceId()}`)
    if (res.ok) {
      const data = await res.json()
      setPhotos(data.photos)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    setName(getStoredName())
    refresh()
  }, [refresh])

  async function uploadFiles(files: File[], uploaderName: string) {
    for (const file of files) {
      const key = `${file.name}-${Date.now()}-${Math.random()}`
      if (!file.type.startsWith('image/')) continue
      if (file.size > MAX_FILE_BYTES) {
        setUploads((u) => [...u, { key, fileName: `${file.name} (too large — 10MB max)`, status: 'error' }])
        continue
      }
      setUploads((u) => [...u, { key, fileName: file.name, status: 'uploading' }])
      try {
        const signRes = await fetch('/api/photos/sign', { method: 'POST' })
        if (signRes.status === 503) { setUploadsAvailable(false); throw new Error('unavailable') }
        if (!signRes.ok) throw new Error('sign failed')
        const sign = await signRes.json()

        const form = new FormData()
        form.append('file', file)
        form.append('api_key', sign.apiKey)
        form.append('timestamp', String(sign.timestamp))
        form.append('signature', sign.signature)
        form.append('upload_preset', sign.uploadPreset)
        form.append('folder', sign.folder)
        const upRes = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`, {
          method: 'POST', body: form,
        })
        if (!upRes.ok) throw new Error('cloudinary upload failed')
        const uploaded = await upRes.json()

        const recRes = await fetch('/api/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicId: uploaded.public_id, name: uploaderName }),
        })
        if (!recRes.ok) throw new Error('record failed')
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, status: 'done' } : x)))
      } catch {
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, status: 'error' } : x)))
      }
    }
    await refresh()
    setTimeout(() => setUploads((u) => u.filter((x) => x.status !== 'done')), 4000)
  }

  function onFilesPicked(list: FileList | null) {
    if (!list?.length) return
    const files = Array.from(list)
    if (!name) {
      pendingFiles.current = files
      setNamePrompt(true)
      return
    }
    uploadFiles(files, name)
  }

  function confirmName() {
    const trimmed = nameDraft.trim()
    if (!trimmed) return
    setStoredName(trimmed)
    setName(trimmed)
    setNamePrompt(false)
    if (pendingFiles.current) {
      uploadFiles(pendingFiles.current, trimmed)
      pendingFiles.current = null
    }
  }

  async function toggleLike(photo: Photo) {
    // optimistic
    setPhotos((ps) => ps.map((p) => p.id === photo.id
      ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) }
      : p))
    const res = await fetch(`/api/photos/${photo.id}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId() }),
    })
    if (res.ok) {
      const { liked, likeCount } = await res.json()
      setPhotos((ps) => ps.map((p) => (p.id === photo.id ? { ...p, likedByMe: liked, likeCount } : p)))
    } else {
      await refresh() // roll back optimism on failure
    }
  }

  async function addComment(photo: Photo) {
    const text = (commentDrafts[photo.id] ?? '').trim()
    if (!text) return
    if (!name) { setNamePrompt(true); return }
    const res = await fetch(`/api/photos/${photo.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, comment: text }),
    })
    if (res.ok) {
      const { comment } = await res.json()
      setPhotos((ps) => ps.map((p) => (p.id === photo.id ? { ...p, comments: [...p.comments, comment] } : p)))
      setCommentDrafts((d) => ({ ...d, [photo.id]: '' }))
    }
  }

  return (
    <div className="min-h-screen bg-[#fdfcfb]">
      <header className="bg-[#00330a] text-white py-10 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-serif" style={{ fontFamily: 'Playfair Display, serif' }}>
          Photo Gallery
        </h1>
        <p className="mt-3 text-[#D4AF37]" style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.25rem' }}>
          Share your photos of Emme &amp; Connor&apos;s celebration
        </p>
        <button
          onClick={() => fileInput.current?.click()}
          disabled={!uploadsAvailable}
          className="mt-6 bg-[#D4AF37] text-[#00330a] font-semibold px-8 py-3 rounded-full hover:bg-[#c19d2e] transition-colors disabled:opacity-60"
        >
          {uploadsAvailable ? '📸 Add your photos' : 'Uploads coming soon'}
        </button>
        <input
          ref={fileInput} type="file" accept="image/*" multiple hidden
          onChange={(e) => { onFilesPicked(e.target.files); e.target.value = '' }}
        />
      </header>

      {uploads.length > 0 && (
        <div className="max-w-3xl mx-auto mt-4 px-4 space-y-1">
          {uploads.map((u) => (
            <div key={u.key} className="flex items-center justify-between text-sm bg-white rounded px-3 py-2 shadow">
              <span className="truncate">{u.fileName}</span>
              {u.status === 'uploading' && <span className="text-gray-500">Uploading…</span>}
              {u.status === 'done' && <span className="text-green-700">✓ Shared</span>}
              {u.status === 'error' && <span className="text-red-600">Failed</span>}
            </div>
          ))}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-10">
        {loading ? (
          <p className="text-center text-gray-500">Loading photos…</p>
        ) : photos.length === 0 ? (
          <p className="text-center text-gray-500">No photos yet — be the first to share one!</p>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 [&>*]:mb-4">
            {photos.map((photo) => (
              <div key={photo.id} className="break-inside-avoid bg-white rounded-lg shadow overflow-hidden">
                {/* Cloudinary delivery URLs are dynamic; next/image needs remotePatterns config — plain img keeps it simple */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.thumbnailUrl ?? photo.fileUrl} alt={photo.caption ?? 'Wedding photo'} className="w-full" loading="lazy" />
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">
                      {photo.uploadedByName ? `Shared by ${photo.uploadedByName}` : 'A wedding guest'}
                    </span>
                    <button onClick={() => toggleLike(photo)} className="text-sm" aria-label="Like photo">
                      {photo.likedByMe ? '❤️' : '🤍'} {photo.likeCount > 0 ? photo.likeCount : ''}
                    </button>
                  </div>
                  {photo.caption && <p className="mt-1 text-sm text-gray-600">{photo.caption}</p>}
                  <button
                    onClick={() => setOpenComments((o) => ({ ...o, [photo.id]: !o[photo.id] }))}
                    className="mt-2 text-xs text-[#00330a] underline"
                  >
                    {photo.comments.length > 0 ? `${photo.comments.length} comment${photo.comments.length === 1 ? '' : 's'}` : 'Add a comment'}
                  </button>
                  {openComments[photo.id] && (
                    <div className="mt-2 space-y-2">
                      {photo.comments.map((c) => (
                        <p key={c.id} className="text-xs text-gray-700">
                          <span className="font-semibold">{c.authorName}:</span> {c.comment}
                        </p>
                      ))}
                      <div className="flex gap-2">
                        <input
                          value={commentDrafts[photo.id] ?? ''}
                          onChange={(e) => setCommentDrafts((d) => ({ ...d, [photo.id]: e.target.value }))}
                          maxLength={500}
                          placeholder="Say something nice…"
                          className="flex-1 border rounded px-2 py-1 text-xs"
                        />
                        <button onClick={() => addComment(photo)} className="text-xs bg-[#00330a] text-white px-3 rounded">
                          Post
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {namePrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h2 className="text-lg font-semibold text-[#00330a]">What&apos;s your name?</h2>
            <p className="text-sm text-gray-600 mt-1">So Emme &amp; Connor know who shared — we&apos;ll remember it on this device.</p>
            <input
              autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={100}
              onKeyDown={(e) => e.key === 'Enter' && confirmName()}
              className="mt-3 w-full border rounded px-3 py-2"
              placeholder="Your name"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setNamePrompt(false); pendingFiles.current = null }} className="px-4 py-2 text-sm text-gray-600">
                Cancel
              </button>
              <button onClick={confirmName} className="px-4 py-2 text-sm bg-[#00330a] text-white rounded">
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

React key insight for the reviewer: state is optimistic for likes only; uploads and comments confirm against the server before rendering.

- [ ] **Step 2: Build check**

Run: `npx next build 2>&1 | tail -15`
Expected: build succeeds (`/photos` appears in the route list).

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/photos/"
git commit -m "feat(photos): public gallery page — upload, likes, comments"
```

---

### Task 12: Admin `/admin/photos` page + home nav links

**Files:**
- Create: `app/admin/photos/page.tsx`
- Modify: `app/page.tsx` (footer nav, ~line 313)

- [ ] **Step 1: Implement the admin page**

```tsx
// app/admin/photos/page.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'

type AdminComment = { id: string; authorName: string; comment: string; createdAt: string; isHidden: boolean }
type AdminPhoto = {
  id: string; uploadedByName: string | null; caption: string | null
  thumbnailUrl: string | null; fileUrl: string; createdAt: string
  isHidden: boolean; likeCount: number; comments: AdminComment[]
}

export default function AdminPhotosPage() {
  const [photos, setPhotos] = useState<AdminPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    const res = await fetch('/api/admin/photos')
    if (res.ok) {
      setPhotos((await res.json()).photos)
      setError('')
    } else {
      setError('Failed to load photos')
    }
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function setPhotoHidden(id: string, isHidden: boolean) {
    await fetch(`/api/admin/photos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isHidden }),
    })
    refresh()
  }

  async function deletePhoto(id: string) {
    if (!confirm('Permanently delete this photo (including from Cloudinary)? This cannot be undone.')) return
    await fetch(`/api/admin/photos/${id}`, { method: 'DELETE' })
    refresh()
  }

  async function setCommentHidden(photoId: string, commentId: string, isHidden: boolean) {
    await fetch(`/api/admin/photos/${photoId}/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isHidden }),
    })
    refresh()
  }

  async function deleteComment(photoId: string, commentId: string) {
    if (!confirm('Permanently delete this comment?')) return
    await fetch(`/api/admin/photos/${photoId}/comments/${commentId}`, { method: 'DELETE' })
    refresh()
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-[#00330a]">Photo Gallery Moderation</h1>
      <p className="text-sm text-gray-600 mt-1">
        Guest photos are live the moment they&apos;re uploaded. Hide removes a photo from the public
        gallery (reversible); Delete removes it permanently, including the stored image.
      </p>
      {error && <p className="mt-4 text-red-600">{error}</p>}
      {loading ? (
        <p className="mt-6 text-gray-500">Loading…</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {photos.map((p) => (
            <div key={p.id} className={`bg-white rounded-lg shadow overflow-hidden ${p.isHidden ? 'opacity-50' : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumbnailUrl ?? p.fileUrl} alt={p.caption ?? 'Guest photo'} className="w-full h-48 object-cover" />
              <div className="p-3 text-sm">
                <div className="flex justify-between text-gray-700">
                  <span>{p.uploadedByName ?? 'Unknown'}</span>
                  <span>❤️ {p.likeCount}</span>
                </div>
                {p.caption && <p className="text-gray-500 mt-1">{p.caption}</p>}
                {p.isHidden && <p className="text-amber-700 font-semibold mt-1">Hidden from gallery</p>}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setPhotoHidden(p.id, !p.isHidden)}
                    className="px-3 py-1 rounded bg-amber-600 text-white text-xs"
                  >
                    {p.isHidden ? 'Unhide' : 'Hide'}
                  </button>
                  <button onClick={() => deletePhoto(p.id)} className="px-3 py-1 rounded bg-red-600 text-white text-xs">
                    Delete
                  </button>
                </div>
                {p.comments.length > 0 && (
                  <div className="mt-3 border-t pt-2 space-y-1">
                    {p.comments.map((c) => (
                      <div key={c.id} className={`flex items-start justify-between gap-2 ${c.isHidden ? 'opacity-50' : ''}`}>
                        <p className="text-xs"><span className="font-semibold">{c.authorName}:</span> {c.comment}</p>
                        <span className="flex gap-1 shrink-0">
                          <button onClick={() => setCommentHidden(p.id, c.id, !c.isHidden)} className="text-xs text-amber-700 underline">
                            {c.isHidden ? 'unhide' : 'hide'}
                          </button>
                          <button onClick={() => deleteComment(p.id, c.id)} className="text-xs text-red-700 underline">
                            delete
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {photos.length === 0 && <p className="text-gray-500">No guest photos yet.</p>}
        </div>
      )}
    </div>
  )
}
```

(The admin layout already wraps this route with the persistent nav + session guard via `middleware.ts`; the dashboard's existing "Photo Gallery" tile at `app/admin/page.tsx` now resolves.)

- [ ] **Step 2: Add public footer nav link**

In `app/page.tsx`, find the footer nav (~line 313):

```tsx
<Link href="/wedding-party" className="hover:text-white transition-colors">Wedding Party</Link>
```

Add immediately after it:

```tsx
<Link href="/photos" className="hover:text-white transition-colors">Photos</Link>
```

- [ ] **Step 3: Build check**

Run: `npx next build 2>&1 | tail -15`
Expected: build succeeds, `/admin/photos` and `/photos` both in the route list.

- [ ] **Step 4: Commit**

```bash
git add app/admin/photos/ app/page.tsx
git commit -m "feat(photos): admin moderation page + public nav link"
```

---

### Task 13: Table QR assets

**Files:**
- Create: `scripts/generate-photos-qr.py`
- Create: `assets/photos-qr/` (generated: `photos-qr-branded.png`, `photos-qr-plain.png`, `README.md`)

- [ ] **Step 1: Write the generator (mirrors the invitation QR design)**

```python
# scripts/generate-photos-qr.py
# Table/room QR pointing to the photo gallery. Style matches assets/invitation-qr.
# Run: python3 scripts/generate-photos-qr.py   (needs: pip install segno pillow)
import segno
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

URL = "https://walters-pierce-wedding.com/photos"
OUT = Path("assets/photos-qr")
OUT.mkdir(parents=True, exist_ok=True)

GREEN, GOLD, CREAM = "#00330a", "#D4AF37", "#FFFDF7"

qr = segno.make(URL, error="h")  # level H: 30% redundancy tolerates the monogram
qr.save(OUT / "photos-qr-plain.png", scale=20, border=4, dark="black", light="white")
qr.save(OUT / "photos-qr-branded-base.png", scale=20, border=4, dark=GREEN, light=CREAM)

# Center monogram: gold ring + camera glyph
img = Image.open(OUT / "photos-qr-branded-base.png").convert("RGB")
w, h = img.size
d = ImageDraw.Draw(img)
r = w // 10
cx, cy = w // 2, h // 2
d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=CREAM, outline=GOLD, width=max(4, w // 150))
try:
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Didot.ttc", int(r * 1.1))
except OSError:
    font = ImageFont.load_default()
d.text((cx, cy), "P", font=font, fill=GREEN, anchor="mm")
img.save(OUT / "photos-qr-branded.png")
(OUT / "photos-qr-branded-base.png").unlink()
print(f"Wrote {OUT}/photos-qr-branded.png and photos-qr-plain.png")
```

- [ ] **Step 2: Generate and decode-test**

Run:
```bash
python3 -m pip install --quiet segno pillow opencv-python-headless 2>/dev/null
python3 scripts/generate-photos-qr.py
python3 - <<'EOF'
import cv2
for f in ["assets/photos-qr/photos-qr-branded.png", "assets/photos-qr/photos-qr-plain.png"]:
    data, *_ = cv2.QRCodeDetector().detectAndDecode(cv2.imread(f))
    assert data == "https://walters-pierce-wedding.com/photos", f"{f} decoded to {data!r}"
    print(f"OK {f}")
EOF
```
Expected: `OK` for both files. If opencv install fails, scan both PNGs with a phone camera instead and confirm they open `/photos`.

- [ ] **Step 3: Write the README**

Create `assets/photos-qr/README.md` following the exact structure of `assets/invitation-qr/README.md`: state the URL, the file table (branded = give to print designer, plain = safety net), design notes (green modules, gold-ringed "P" monogram, error correction H), print guidance (min 1×1 in, quiet zone, test-scan the printed proof with iPhone + Android), and how it was verified.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-photos-qr.py assets/photos-qr/
git commit -m "content(photos): branded table QR assets pointing to /photos"
```

---

### Task 14: Full verification + live smoke test

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npx jest 2>&1 | tail -5`
Expected: all suites pass (previous count + the 6 new suites), zero failures.

- [ ] **Step 2: Production build**

Run: `npx next build 2>&1 | tail -10`
Expected: success.

- [ ] **Step 3: Live smoke via dev server** (use the Browser pane / launch.json dev config, not raw Bash)

1. Open `/photos` — empty-state message renders.
2. Upload a small test image → name prompt appears → enter a name → photo appears in grid within seconds; confirm the file landed in Cloudinary's Media Library under `guest-photos/`.
3. Like it (heart fills, count 1); reload — still liked (deviceId persisted).
4. Comment on it — appears immediately.
5. Open `/admin/photos` (logged in) — photo + comment visible; Hide the photo → gone from `/photos`; Unhide → back; Delete → gone from both DB and Cloudinary Media Library.
6. Temporarily rename `CLOUDINARY_CLOUD_NAME` in `.env.local`, restart dev server, confirm `/photos` shows "Uploads coming soon" and no crash; restore the var.

- [ ] **Step 4: Commit any fixes, then final commit**

```bash
git add -A && git commit -m "test(photos): verification fixes from live smoke" # only if fixes were needed
```

---

## Deploy runbook (after merge approval — do NOT push without Whitney's go-ahead; push = Railway auto-deploy)

1. Add `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` to Railway variables.
2. Preset already exists in the Cloudinary account (Task 4 ran against the real account — presets are account-level, nothing to redo for prod).
3. Merge `feature/guest-photos` → `main`, push. Railway runs `prisma migrate deploy` automatically.
4. Prod smoke: repeat Task 14 step 3 items 1–5 against the live domain.
5. Print table QRs from `assets/photos-qr/photos-qr-branded.png` (test-scan the printed proof).

## Spec-coverage self-check

- Public gallery w/ likes+comments → Tasks 6–8, 11 ✓
- Signed direct-to-Cloudinary, images only, size cap → Tasks 3–5, 11 (10MB — free-tier constraint, noted) ✓
- Ask-once name + deviceId → Task 10, 11 ✓
- Reactive moderation hide/delete incl. Cloudinary destroy → Tasks 9, 12 ✓
- Migration (photo_likes, isHidden, optional authorEmail) → Task 1 ✓
- Graceful degradation when unconfigured → Tasks 5, 11, 14.3.6 ✓
- QR assets → Task 13 ✓
- Nav link + dashboard tile resolves → Task 12 ✓
