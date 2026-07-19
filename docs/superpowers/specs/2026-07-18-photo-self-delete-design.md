# Photo Self-Delete + Owner Delete — Design Spec

**Date:** 2026-07-18
**Status:** Approved (design), pending spec review
**Author:** Whitney + Claude

## Problem

Nicolle asked (after testing) that people be able to delete photos from the public `/photos` page, so removals don't all have to go through the admin panel. Two audiences:
1. **Guests** should be able to delete a photo **they** uploaded (their own mistakes), without a login.
2. **The couple (Emme & Connor)** and Nicolle should be able to delete **any** photo directly on the public page, so the owners have full control of the content without switching to `/admin/photos`.

The admin panel (`/admin/photos`, hide/delete + Cloudinary cleanup) already exists and stays as the catch-all.

## Constraints & existing building blocks

- **No guest login.** Guest ownership must be proven by the existing anonymous per-device token: `getDeviceId()` in `components/photos/identity.ts` mints a random UUID in localStorage; likes already scope by it.
- **`Photo` has no device link today** (only `uploadedByName`/`uploadedByEmail`). There are **0 photos live** in prod now, so no backfill concern.
- **Admin delete pattern** (`app/api/admin/photos/[id]/route.ts`): session guard → `findFirst({ category:'guest' })` → `destroyPhoto(cloudinaryPublicId)` → `prisma.photo.delete` (comments + likes cascade via `onDelete: Cascade`). The new endpoint mirrors this.
- **"Delete any" must be session-gated** — on a public page we otherwise cannot distinguish an owner from a guest. Emme & Connor get their own admin `User` accounts (decision: their own logins, both of them).

## Architecture

### 1. Data model — add `Photo.deviceId` (migration)

Add a nullable column:
```prisma
deviceId String? @map("device_id")
```
Recorded at upload so a photo can be tied to the browser that created it. Nullable → old photos (none exist) are simply not self-deletable (admin-only). Additive migration, safe; Railway applies via `prisma migrate deploy`.

### 2. Record `deviceId` on upload — `POST /api/photos`

- Extend `createSchema` with `deviceId: z.string().max(100).optional()`.
- Persist it in `prisma.photo.create({ data: { …, deviceId: deviceId || null } })`.
- The client sends `getDeviceId()` in the POST body.

### 3. Ownership signal — `GET /api/photos`

- The list already receives `?deviceId=`. Include `deviceId` in the query's field selection **only to compute** a per-photo boolean `mine = photo.deviceId != null && photo.deviceId === requesterDeviceId`.
- **Never return the raw `deviceId`** to the client — only the `mine` boolean (same privacy posture as `likedByMe`).

### 4. Delete endpoint — `DELETE /api/photos/[id]` (new)

One endpoint, two authorization paths:
- Read `deviceId` from `?deviceId=`.
- Load the photo: `findFirst({ where: { id, category: 'guest' } })`; if none → **404**.
- **Authorize if EITHER:**
  - a valid **admin session** (`getServerSession(authOptions)`, `role === 'admin'`) — owners/Nicolle delete any; **or**
  - `photo.deviceId != null && photo.deviceId === deviceId` — guest deletes their own.
- Otherwise → **403**.
- On success: `if (photo.cloudinaryPublicId) await destroyPhoto(...)`, then `prisma.photo.delete({ where: { id } })` (cascades comments + likes). Return `{ ok: true }`.

Rationale for a single endpoint: the page always calls the same URL and the server decides; no branching in the client, and admin-any + self-delete share the Cloudinary-cleanup logic.

### 5. Public page UI — `app/(public)/photos/page.tsx`

- On upload, include `deviceId: getDeviceId()` in the POST body.
- On load, detect admin via `fetch('/api/auth/session')` → `isAdmin = data?.user?.role === 'admin'` (avoids rewiring a `SessionProvider` into the public tree).
- Render a small **Delete** control on a photo card when `photo.mine || isAdmin`.
- Click → confirm dialog ("Delete this photo? This can't be undone.") → `DELETE /api/photos/${id}?deviceId=${getDeviceId()}` → on success remove the photo from the grid (optimistic, with revert + message on failure).

### 6. Owner admin accounts — `scripts/create-admin-user.mjs` (new)

- A script that upserts an admin `User` (`email`, bcrypt `passwordHash`, `role: 'admin'`) — the DB-user path `lib/auth.ts` already authenticates (`bcrypt.compare`, returns `role`).
- Reads email + password from CLI args / env so **Whitney runs it and chooses the passwords — Claude never handles passwords or creates the accounts itself.** Run once for Emme and once for Connor against prod (same `DATABASE_URL=<public proxy URL>` pattern as the registry/venue seeds).
- Idempotent (upsert by email); re-running updates the password.

### 7. Admin panel — unchanged

`/admin/photos` remains the catch-all moderation surface.

## Data flow

```
Upload:  client → getDeviceId() in POST /api/photos → Photo.deviceId stored
List:    GET /api/photos?deviceId=X → each photo gets mine = (deviceId===X); raw token withheld
Delete:  page (mine || isAdmin) → DELETE /api/photos/[id]?deviceId=X
           → authorize: admin session OR deviceId match
           → destroyPhoto(cloudinary) + photo.delete (cascade) → grid removes card
Owner access: Whitney runs scripts/create-admin-user.mjs for Emme + Connor → they log in → isAdmin true → delete-any
```

## Error handling

- Delete: 404 (missing/non-guest photo), 403 (neither admin nor owner), 500 (logged) — Cloudinary failure inside a try/catch shouldn't leave a dangling DB row unhandled (mirror admin route ordering: destroy then delete; if destroy throws, the row remains and can be retried via admin).
- Page: failed delete reverts the optimistic removal and shows a friendly message; storage-blocked `getDeviceId()` still returns an in-memory id (existing behavior), so self-delete works within the session.
- Session fetch failure → treat as non-admin (no delete-any), guest self-delete still works.

## Testing

- **DELETE endpoint auth matrix** (unit, mocked prisma + next-auth): admin session → deletes; matching deviceId, no session → deletes; wrong deviceId, no session → 403; no deviceId, no session → 403; unknown id → 404; verifies `destroyPhoto` called when `cloudinaryPublicId` present.
- **GET `mine` flag** — photo whose `deviceId` equals the query param → `mine:true`; different/absent → `mine:false`; raw `deviceId` never present in the response body.
- **POST records `deviceId`** — create called with the submitted deviceId; absent → stored null.
- Existing photo/admin tests stay green.

## Files

- `prisma/schema.prisma` — add `Photo.deviceId` + generated migration.
- `app/api/photos/route.ts` — POST persists `deviceId`; GET returns `mine`.
- `app/api/photos/[id]/route.ts` — **new** DELETE (dual auth) [+ `__tests__`].
- `app/(public)/photos/page.tsx` — send deviceId on upload; admin detection; delete button + confirm + optimistic removal.
- `scripts/create-admin-user.mjs` — **new** (Whitney runs for Emme + Connor).

## Out of scope (YAGNI)

- Editing photos/captions after upload.
- Bulk delete.
- An in-app admin-user management UI (the script suffices for two accounts).
- Undo/trash (hard delete with a confirm dialog, matching admin behavior).
