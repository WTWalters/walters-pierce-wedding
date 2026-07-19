# Photo Self-Delete + Owner Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let guests delete photos they uploaded (proven by their private per-device token) and let any admin (Emme/Connor/Nicolle via the shared login) delete any photo — all from the public `/photos` page, without touching the existing admin panel.

**Architecture:** Add a nullable `Photo.deviceId` recorded at upload. `GET /api/photos` returns a per-photo `mine` boolean (never the raw token). A new `DELETE /api/photos/[id]` authorizes on EITHER an admin session OR a matching device token, then removes the row + Cloudinary asset (cascading likes/comments). The public page shows a Delete button when a photo is `mine` or the viewer has an admin session (detected via `fetch('/api/auth/session')`).

**Tech Stack:** Next.js 15 App Router, Prisma/PostgreSQL, NextAuth (admin guard), Cloudinary, Jest (babel-jest; mocks next/server + next-auth + @/lib/prisma + @/lib/cloudinary). Run tests/build/prisma under Node 22 (`export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22` — Node 16 crashes Prisma 6).

**Spec:** `docs/superpowers/specs/2026-07-18-photo-self-delete-design.md`

---

## File Structure

- Modify `prisma/schema.prisma` — add `Photo.deviceId` + generated migration under `prisma/migrations/`.
- Modify `app/api/photos/route.ts` — POST persists `deviceId`; GET returns `mine`.
- Modify `app/api/photos/__tests__/photos-route.test.ts` — cover `mine` + deviceId persistence.
- Create `app/api/photos/[id]/route.ts` — new dual-auth DELETE.
- Create `app/api/photos/[id]/__tests__/delete-route.test.ts` — auth matrix.
- Modify `app/(public)/photos/page.tsx` — deviceId on upload, admin detection, delete button + confirm + optimistic removal.

---

## Task 1: Schema migration — `Photo.deviceId`

**Files:**
- Modify: `prisma/schema.prisma` (Photo model)

- [ ] **Step 1: Add the column to the Photo model**

In `prisma/schema.prisma`, inside `model Photo`, add this line right after the `cloudinaryPublicId` line:

```prisma
  deviceId           String?        @map("device_id")
```

- [ ] **Step 2: Generate + apply the migration**

Run:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22
npx prisma migrate dev --name add_photo_device_id
```
Expected: Prisma creates `prisma/migrations/<timestamp>_add_photo_device_id/migration.sql` containing `ALTER TABLE "photos" ADD COLUMN "device_id" TEXT;`, applies it to the dev DB, and regenerates the client. "Your database is now in sync with your schema."

**If this fails** with a DB-connectivity error (P1001) or drift you can't safely resolve: STOP and report **BLOCKED** with the exact output — do not force-reset the database. (Fallback the controller may choose: hand-write the migration folder + `migration.sql` above and run `npx prisma generate`, letting Railway apply it via `migrate deploy`.)

- [ ] **Step 3: Verify the client has the field**

Run:
```bash
grep -n "device_id" prisma/schema.prisma
npx prisma generate 2>&1 | tail -3
```
Expected: the `device_id` mapping is present; `generate` succeeds ("Generated Prisma Client").

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(photos): add Photo.deviceId column for upload ownership"
```

---

## Task 2: Record `deviceId` on upload + return `mine` — `app/api/photos/route.ts`

**Files:**
- Modify: `app/api/photos/route.ts`
- Test: `app/api/photos/__tests__/photos-route.test.ts`

- [ ] **Step 1: Update the tests first (TDD)**

In `app/api/photos/__tests__/photos-route.test.ts`:

(a) Add `deviceId` to the `dbPhoto` fixture — change the fixture's first line (currently `id: 'p1', uploadedByName: 'Ann', caption: null, fileUrl: 'F', thumbnailUrl: 'T',`) to include it:
```ts
  id: 'p1', uploadedByName: 'Ann', caption: null, fileUrl: 'F', thumbnailUrl: 'T', deviceId: 'dev-1',
```

(b) In the GET test `'lists visible photos with like count and likedByMe'`, extend the final assertion to also check `mine`:
```ts
    expect(res.body.photos[0]).toMatchObject({ id: 'p1', likeCount: 1, likedByMe: true, mine: true })
```

(c) In the GET test `'likedByMe is false for other devices'`, extend the assertion:
```ts
    expect(res.body.photos[0]).toMatchObject({ likeCount: 1, likedByMe: false, mine: false })
```

(d) Add this test to the `describe('GET', …)` block:
```ts
  it('never leaks the raw deviceId to the client', async () => {
    ;(prisma.photo.findMany as jest.Mock).mockResolvedValue([dbPhoto])
    const res = (await GET(makeGet('http://x/api/photos?deviceId=dev-1'))) as {
      body: { photos: Array<Record<string, unknown>> }
    }
    expect(res.body.photos[0]).not.toHaveProperty('deviceId')
  })
```

(e) Add this test to the `describe('POST', …)` block:
```ts
  it('records the uploader deviceId when provided', async () => {
    ;(verifyGuestPhoto as jest.Mock).mockResolvedValue({ secureUrl: 'S' })
    ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.photo.create as jest.Mock).mockResolvedValue({ id: 'new' })
    await POST(makePost({ ...valid, deviceId: 'dev-9' }))
    expect(prisma.photo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ deviceId: 'dev-9' }),
    })
  })
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `nvm use 22 && npx jest app/api/photos/__tests__/photos-route.test.ts`
Expected: the new `mine`/`deviceId` assertions FAIL (route doesn't emit `mine` or persist `deviceId` yet).

- [ ] **Step 3: Implement — add `deviceId` to the schema, persist it, and emit `mine`**

In `app/api/photos/route.ts`:

(a) Extend `createSchema`:
```ts
const createSchema = z.object({
  publicId: z.string().min(1).max(300),
  name: z.string().trim().min(1).max(100),
  caption: z.string().trim().max(280).optional(),
  deviceId: z.string().max(100).optional(),
})
```

(b) In `GET`, add `mine` to the mapped object (right after the `likedByMe` line). `findMany` with `include` already returns all Photo scalars, so `p.deviceId` is available without changing the query. Do NOT add `deviceId` to the returned object:
```ts
        likedByMe: deviceId !== '' && p.likes.some((l) => l.deviceId === deviceId),
        mine: deviceId !== '' && p.deviceId === deviceId,
```

(c) In `POST`, destructure and persist `deviceId`:
```ts
    const { publicId, name, caption, deviceId } = parsed.data
```
and in the `prisma.photo.create({ data: { … } })` object, add after `caption: caption || null,`:
```ts
        deviceId: deviceId || null,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `nvm use 22 && npx jest app/api/photos/__tests__/photos-route.test.ts`
Expected: PASS (all, including the new cases).

- [ ] **Step 5: Commit**

```bash
git add app/api/photos/route.ts app/api/photos/__tests__/photos-route.test.ts
git commit -m "feat(photos): record uploader deviceId and expose a per-photo 'mine' flag"
```

---

## Task 3: Dual-auth delete endpoint — `DELETE /api/photos/[id]`

**Files:**
- Create: `app/api/photos/[id]/route.ts`
- Test: `app/api/photos/[id]/__tests__/delete-route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/api/photos/[id]/__tests__/delete-route.test.ts`:
```ts
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { photo: { findFirst: jest.fn(), delete: jest.fn() } } }))
jest.mock('@/lib/cloudinary', () => ({ destroyPhoto: jest.fn() }))

import { getServerSession } from 'next-auth'
import { DELETE } from '../route'
import { prisma } from '@/lib/prisma'
import { destroyPhoto } from '@/lib/cloudinary'

const req = (deviceId?: string) =>
  ({ url: `http://x/api/photos/p1${deviceId ? `?deviceId=${deviceId}` : ''}` }) as never
const ctx = { params: Promise.resolve({ id: 'p1' }) }

const guestPhoto = { id: 'p1', category: 'guest', cloudinaryPublicId: 'guest-photos/abc', deviceId: 'dev-1' }

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue(guestPhoto)
  ;(prisma.photo.delete as jest.Mock).mockResolvedValue({})
})

it('404s when the photo does not exist', async () => {
  ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue(null)
  const res = (await DELETE(req('dev-1'), ctx)) as { status: number }
  expect(res.status).toBe(404)
  expect(prisma.photo.delete).not.toHaveBeenCalled()
})

it('lets an admin session delete any photo (no deviceId)', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
  const res = (await DELETE(req(), ctx)) as { body: unknown; status: number }
  expect(res.status).toBe(200)
  expect(destroyPhoto).toHaveBeenCalledWith('guest-photos/abc')
  expect(prisma.photo.delete).toHaveBeenCalledWith({ where: { id: 'p1' } })
})

it('lets the uploading device delete its own photo (no session)', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  const res = (await DELETE(req('dev-1'), ctx)) as { status: number }
  expect(res.status).toBe(200)
  expect(prisma.photo.delete).toHaveBeenCalledWith({ where: { id: 'p1' } })
})

it('403s a non-admin with a mismatched deviceId', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  const res = (await DELETE(req('someone-else'), ctx)) as { status: number }
  expect(res.status).toBe(403)
  expect(prisma.photo.delete).not.toHaveBeenCalled()
})

it('403s a non-admin with no deviceId', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
  const res = (await DELETE(req(), ctx)) as { status: number }
  expect(res.status).toBe(403)
  expect(prisma.photo.delete).not.toHaveBeenCalled()
})

it('does not require a Cloudinary destroy when there is no public id', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
  ;(prisma.photo.findFirst as jest.Mock).mockResolvedValue({ ...guestPhoto, cloudinaryPublicId: null })
  const res = (await DELETE(req(), ctx)) as { status: number }
  expect(res.status).toBe(200)
  expect(destroyPhoto).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nvm use 22 && npx jest app/api/photos/[id]/__tests__/delete-route.test.ts`
Expected: FAIL — cannot find module `../route`.

- [ ] **Step 3: Write the implementation**

Create `app/api/photos/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { destroyPhoto } from '@/lib/cloudinary'

// Two authorization paths: a valid admin session (Emme/Connor/Nicolle → delete
// any) OR a deviceId that matches the photo's uploader token (guest → delete own).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const deviceId = new URL(request.url).searchParams.get('deviceId') ?? ''

    const photo = await prisma.photo.findFirst({ where: { id, category: 'guest' } })
    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    const session = await getServerSession(authOptions)
    const isAdmin = session?.user?.role === 'admin'
    const isOwner = photo.deviceId != null && deviceId !== '' && photo.deviceId === deviceId

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
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

- [ ] **Step 4: Run test to verify it passes**

Run: `nvm use 22 && npx jest app/api/photos/[id]/__tests__/delete-route.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/photos/[id]/route.ts app/api/photos/[id]/__tests__/delete-route.test.ts
git commit -m "feat(photos): DELETE /api/photos/[id] — admin-any or own-device authorization"
```

---

## Task 4: Public page — delete button, admin detection, deviceId on upload

**Files:**
- Modify: `app/(public)/photos/page.tsx`

> Client page behind no jest coverage; verified by production build. Its delete/auth logic leans on the Task 2/3 endpoints (already tested).

- [ ] **Step 1: Add `mine` to the Photo type**

In `app/(public)/photos/page.tsx`, change the `Photo` type's third line:
```ts
  likeCount: number; likedByMe: boolean; mine: boolean; comments: Comment[]
```

- [ ] **Step 2: Track admin session state**

Add an `isAdmin` state and detect it on mount. Add near the other `useState` calls (after `const [photos, setPhotos] = useState<Photo[]>([])`):
```tsx
  const [isAdmin, setIsAdmin] = useState(false)
```
And add this effect next to the existing initial-load effect (place it right after the component's existing `useEffect` that loads photos):
```tsx
  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setIsAdmin(s?.user?.role === 'admin'))
      .catch(() => setIsAdmin(false))
  }, [])
```

- [ ] **Step 3: Send deviceId on upload**

In the upload flow, change the record POST body (currently `body: JSON.stringify({ publicId: uploaded.public_id, name: uploaderName }),`) to:
```tsx
          body: JSON.stringify({ publicId: uploaded.public_id, name: uploaderName, deviceId: getDeviceId() }),
```

- [ ] **Step 4: Add the delete handler**

Add this function inside the component, next to `toggleLike` / `addComment`:
```tsx
  const deletePhoto = async (photo: Photo) => {
    if (!confirm('Delete this photo? This can’t be undone.')) return
    const prev = photos
    setPhotos((ps) => ps.filter((p) => p.id !== photo.id)) // optimistic
    try {
      const res = await fetch(`/api/photos/${photo.id}?deviceId=${getDeviceId()}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
    } catch {
      setPhotos(prev) // revert
      alert('Sorry — that photo could not be deleted. Please try again.')
    }
  }
```

- [ ] **Step 5: Render the Delete button on eligible cards**

In the card's header row, replace the like button block so a Delete control shows when the photo is `mine` or the viewer is an admin. Change:
```tsx
                    <button onClick={() => toggleLike(photo)} className="text-sm" aria-label={photo.likedByMe ? 'Unlike photo' : 'Like photo'}>
                      {photo.likedByMe ? '❤️' : '🤍'} {photo.likeCount > 0 ? photo.likeCount : ''}
                    </button>
```
to:
```tsx
                    <span className="flex items-center gap-3">
                      <button onClick={() => toggleLike(photo)} className="text-sm" aria-label={photo.likedByMe ? 'Unlike photo' : 'Like photo'}>
                        {photo.likedByMe ? '❤️' : '🤍'} {photo.likeCount > 0 ? photo.likeCount : ''}
                      </button>
                      {(photo.mine || isAdmin) && (
                        <button
                          onClick={() => deletePhoto(photo)}
                          className="text-xs text-red-600 hover:text-red-800"
                          aria-label="Delete photo"
                        >
                          Delete
                        </button>
                      )}
                    </span>
```

- [ ] **Step 6: Verify the build compiles**

Run: `nvm use 22 && npx next build 2>&1 | grep -E "photos|Compiled successfully|error"`
Expected: `✓ Compiled successfully`, `/photos` present, no errors.

- [ ] **Step 7: Commit**

```bash
git add "app/(public)/photos/page.tsx"
git commit -m "feat(photos): delete control on the gallery (own photos + admin-any) with confirm"
```

---

## Task 5: Full verification

- [ ] **Step 1: Full test suite**

Run: `nvm use 22 && npx jest 2>&1 | tail -4`
Expected: all suites pass, including the new/updated photos tests.

- [ ] **Step 2: Production build**

Run: `nvm use 22 && npx next build 2>&1 | tail -20`
Expected: `✓ Compiled successfully`; `/photos` and `/api/photos/[id]` present; no errors.

- [ ] **Step 3: Preview smoke (optional, auth-gated for admin path)**

Start `dev-node22`, load `/photos` (public, 200). The guest self-delete path can be exercised in the browser; the admin-any path needs an admin login (hand to Whitney). No automatic credential entry.

---

## Post-deploy note (no code)

On merge + push, Railway runs `prisma migrate deploy`, applying `add_photo_device_id`. Emme, Connor, and Nicolle use the existing shared admin login to get delete-any on the public page. The admin panel `/admin/photos` is unchanged.

---

## Self-Review

- **Spec coverage:** deviceId column + migration (Task 1 ✓); record on upload (Task 2 step 3c ✓); `mine` flag, token never leaked (Task 2 ✓ + leak test ✓); dual-auth DELETE with Cloudinary + cascade (Task 3 ✓); page delete button for mine||admin, confirm, optimistic revert, admin via `/api/auth/session` (Task 4 ✓); shared-login owner access + admin panel unchanged (post-deploy note ✓, no code). Out-of-scope items (edit, bulk, admin-user UI, undo) correctly absent.
- **Placeholders:** none — every step has full code/commands.
- **Type consistency:** `mine` added to the API output (Task 2b), the page `Photo` type (Task 4 step 1), and consumed in the card condition (Task 4 step 5); `deviceId` schema field (Task 1) matches its use in create (Task 2 step 3c) and the DELETE ownership check (Task 3); `getDeviceId()` (already imported at page top) used consistently for upload + delete.
