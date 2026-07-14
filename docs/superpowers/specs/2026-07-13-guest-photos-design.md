# Guest Photos — Design Spec

**Date:** 2026-07-13
**Status:** Approved by Whitney
**Supersedes:** the paused 2026-07-12 photos brainstorm (approval-gated model)

## Summary

A public `/photos` page where wedding guests browse, upload, like, and comment on
photos. Uploads go live immediately — no pre-approval. Admins moderate reactively
(hide or delete photos/comments) from a new `/admin/photos` page. Table QR codes at
the reception point to `/photos`. Files upload directly from the guest's phone to
Cloudinary via short-lived signatures; the app server never handles image bytes.

## Decisions (and who made them)

| Decision | Outcome |
|---|---|
| Moderation model | **No pre-approval.** Photos/comments appear instantly; admin hide/delete after the fact. Decided by Emme, Connor, and Nicolle: "too busy to gatekeep during the wedding." |
| Gallery visibility | **Public `/photos` page**, linked in site nav. Table QRs point at the same URL. |
| Likes + comments | **In scope.** Like = one per device per photo, toggleable, anonymous. Comments show author name. |
| Attribution | **Ask once, remember on device.** First upload/comment prompts for name (required), stored in localStorage, auto-attached afterwards. |
| Upload mechanism | **A: Signed direct-to-Cloudinary.** Chosen over server-proxied (Railway would carry every byte of reception-night burst load twice) and unsigned presets (permanent open upload door / quota abuse). |
| Media rules | Images only, ~15MB cap, enforced by a **signed upload preset** in Cloudinary. |
| Privacy trade-off | Accepted explicitly: gallery is public and unmoderated-by-default. Wedding-day photos may reveal the venue; the family chose openness, with reactive removal as the safety valve. |

## Architecture

### Pages

**`app/(public)/photos/page.tsx`** — public gallery + upload.
- Grid of visible (`isHidden = false`) guest photos, newest first, paginated.
- Photo card: Cloudinary thumbnail (`f_auto,q_auto,w_600` transform), uploader
  name, optional caption, like button + count, comment list + add-comment form.
- "Add your photos" button → name prompt (first time only) → multi-select image
  picker → per-file upload with progress + retry.
- Device identity: `localStorage` keys `photos.name` (display name) and
  `photos.deviceId` (random UUID, generated on first use; drives like uniqueness).

**`app/admin/photos/page.tsx`** — moderation (fixes the dead dashboard tile).
- Same grid, plus per-photo **Hide/Unhide** (soft, sets `isHidden`) and **Delete**
  (destroys the Cloudinary asset, then deletes the DB row and cascaded comments/likes).
- Per-comment Hide/Delete.
- Guarded by the existing admin middleware/session pattern.

### API routes

Public:
- `GET /api/photos` — visible photos with like counts, own-device like state
  (`deviceId` query param), and visible comments. Cursor pagination.
- `POST /api/photos/sign` — returns `{ timestamp, signature, apiKey, cloudName }`
  for the signed upload preset (folder `guest-photos`). Light in-memory per-IP
  throttle (same spirit as the `loginAttempts` map in `lib/auth.ts`).
- `POST /api/photos` — body `{ publicId, name, caption? }`. Server verifies the
  asset exists in Cloudinary (Admin API lookup) and that it lives under
  `guest-photos/`, then creates the `Photo` row (`category: guest`,
  `uploadedByName`, `fileUrl`/`thumbnailUrl` derived from the public ID).
- `POST /api/photos/[id]/like` — body `{ deviceId }`. Toggle: creates or deletes
  the `PhotoLike`. Returns new count + liked state.
- `POST /api/photos/[id]/comments` — body `{ name, comment }`. Creates a
  visible comment.

Admin (session-guarded, same guard as other `admin/*` routes):
- `PATCH /api/admin/photos/[id]` — `{ isHidden }` toggle.
- `DELETE /api/admin/photos/[id]` — Cloudinary destroy + DB delete.
- `PATCH /api/admin/photos/[id]/comments/[commentId]` — `{ isHidden }` toggle.
- `DELETE /api/admin/photos/[id]/comments/[commentId]` — DB delete.

### Upload data flow

1. Guest picks image(s) on `/photos`.
2. Client → `POST /api/photos/sign` → short-lived signature (Cloudinary signatures
   embed a timestamp; Cloudinary rejects stale ones, ~1h window).
3. Client → `https://api.cloudinary.com/v1_1/<cloud>/image/upload` with file +
   signature + signed preset. Preset enforces: images only, 15MB max, folder
   `guest-photos`, auto-generated eager thumbnail.
4. Client → `POST /api/photos` with the returned `public_id` + name/caption.
5. Server verifies the asset via Cloudinary Admin API, writes the `Photo` row.
6. Gallery refetches; photo is live.

### Schema migration

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

Plus: `isHidden Boolean @default(false)` on `Photo` and `PhotoComment` (mapped
`is_hidden`), and `likes PhotoLike[]` on `Photo`. The existing `isApproved`
machinery on both models is bypassed (left in place, unused) — the live/hidden
axis is `isHidden` only. Migration must be idempotent against unknown prod state
(Railway runs `migrate deploy` on every push).

### Cloudinary integration

- New `lib/cloudinary.ts`: configured SDK client (`cloudinary` npm package),
  `isCloudinaryConfigured()`, signature helper, asset-verify helper, destroy helper.
- Env vars: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
  (`.env.local` + Railway).
- **Graceful degradation** (same pattern as `sendEmail()`): when unconfigured, the
  gallery renders and the upload button shows a friendly "coming soon" state;
  `POST /api/photos/sign` returns 503.
- One-time dashboard setup (documented in the spec's runbook section below):
  create the signed upload preset `guest-photos-signed` (images only, 15MB,
  folder `guest-photos`, eager `w_600,f_auto,q_auto` thumbnail).

**Prerequisite:** Whitney creates the free Cloudinary account and provides the
three env values. Free tier (25 credits/mo ≈ 25GB storage or bandwidth) is ample.

## Validation & error handling

- Zod schemas on every POST/PATCH body; names ≤ 100 chars, captions ≤ 280,
  comments ≤ 500.
- HTML-escape all user text on render (site's existing `escapeHtml` convention).
- Upload failures: per-file status with a Retry button; other files in the batch
  continue independently.
- `POST /api/photos` rejects public IDs outside `guest-photos/` and duplicates
  (unique on `cloudinaryPublicId` at the app level).
- Like toggle race: rely on the DB unique constraint; on P2002, treat as
  "already liked" and toggle off.

## Testing

Jest, following existing conventions (`__tests__`, mocked Prisma/Cloudinary):
- sign route: configured/unconfigured, throttle.
- photo create: happy path, asset-verify failure, folder escape, dup public ID.
- like toggle: like, unlike, P2002 race.
- comments: create, validation bounds.
- admin routes: auth guard, hide/unhide, delete (Cloudinary destroy called).

## QR assets

`assets/photos-qr/` — branded SVG/PNG in the invitation-QR style, encoding
`https://walters-pierce-wedding.com/photos`, plus README. For table cards and
signs around the room.

## Deploy runbook (when built)

1. Whitney: Cloudinary account → 3 env vars into Railway + `.env.local`.
2. Cloudinary dashboard: create signed preset `guest-photos-signed`.
3. Merge → Railway auto-deploys, migration applies via `migrate-and-start.js`.
4. Add `/photos` to public nav + admin dashboard tile (tile already exists).
5. Smoke: upload from a phone, like, comment, hide, delete.
6. Print table QRs from `assets/photos-qr/`.

## Out of scope

- Home-page carousel stays hardcoded (`app/page.tsx`) — untouched.
- No email notifications on uploads/comments.
- `viewCount`, `isFeatured`, `sortOrder`, `uploadedByEmail` stay dormant.
- Video uploads (images only for now).
