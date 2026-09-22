// app/(public)/photos/page.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { getStoredName, setStoredName, getDeviceId } from '@/components/photos/identity'

type Comment = { id: string; authorName: string; comment: string; createdAt: string }
type Photo = {
  id: string; uploadedByName: string | null; caption: string | null
  fileUrl: string; thumbnailUrl: string | null; createdAt: string
  likeCount: number; likedByMe: boolean; mine: boolean; comments: Comment[]
}
type UploadItem = { key: string; fileName: string; status: 'uploading' | 'done' | 'error'; message?: string }

const MAX_FILE_BYTES = 10 * 1024 * 1024 // Cloudinary free-tier image limit

export default function PhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [name, setName] = useState<string | null>(null)
  const [namePrompt, setNamePrompt] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [uploadsAvailable, setUploadsAvailable] = useState(true)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({})
  const [pendingComments, setPendingComments] = useState<Record<string, boolean>>({})
  const [pendingLikes, setPendingLikes] = useState<Record<string, boolean>>({})
  const [likeError, setLikeError] = useState<Record<string, boolean>>({})
  // The full-size viewer: an index into `photos`, so previous/next step through the
  // same order as the grid. null when closed.
  const [viewing, setViewing] = useState<number | null>(null)
  const [commentError, setCommentError] = useState<Record<string, boolean>>({})
  // Only one caption is edited at a time, so a single draft is enough — and it can't
  // leak between photos the way a per-id map could if a save were left half-finished.
  const [editingCaption, setEditingCaption] = useState<string | null>(null)
  const [captionDraft, setCaptionDraft] = useState('')
  const [savingCaption, setSavingCaption] = useState(false)
  const [captionError, setCaptionError] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const pendingFiles = useRef<File[] | null>(null)
  const pendingComment = useRef<{ photoId: string; text: string } | null>(null)
  // Synchronous, unlike pendingLikes state: two taps that land before React
  // re-renders (some Android browsers fire the handler twice) would both pass a
  // state check, and the second request would undo the first.
  const likesInFlight = useRef(new Set<string>())
  // The thumbnail that opened the viewer, so closing it puts focus back there.
  const viewerOpener = useRef<HTMLElement | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/photos?deviceId=${getDeviceId()}`)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setPhotos(data.photos)
      setLoadError(false)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setName(getStoredName())
    refresh()
  }, [refresh])

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setIsAdmin(s?.user?.role === 'admin'))
      .catch(() => setIsAdmin(false))
  }, [])

  const viewer = viewing !== null && photos[viewing] ? { index: viewing, photo: photos[viewing] } : null
  const viewerOpen = viewer !== null

  const closeViewer = useCallback(() => {
    setViewing(null)
    viewerOpener.current?.focus()
    viewerOpener.current = null
  }, [])

  const stepViewer = useCallback((delta: number) => {
    setViewing((v) => {
      if (v === null) return v
      const next = v + delta
      return next < 0 || next >= photos.length ? v : next
    })
  }, [photos.length])

  useEffect(() => {
    if (!viewerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeViewer()
      else if (e.key === 'ArrowRight') stepViewer(1)
      else if (e.key === 'ArrowLeft') stepViewer(-1)
    }
    window.addEventListener('keydown', onKey)
    // The gallery behind the viewer must not scroll under a swipe.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [viewerOpen, closeViewer, stepViewer])

  // If the gallery shrinks under an open viewer (a photo deleted, a rollback), stay
  // on a photo that still exists rather than pointing past the end.
  useEffect(() => {
    if (viewing !== null && viewing >= photos.length) {
      setViewing(photos.length ? photos.length - 1 : null)
    }
  }, [viewing, photos.length])

  // Fetch the neighbours ahead of a swipe so the next photo is there when it arrives.
  useEffect(() => {
    if (viewing === null) return
    for (const p of [photos[viewing - 1], photos[viewing + 1]]) {
      if (p) new Image().src = p.fileUrl
    }
  }, [viewing, photos])

  // One finger only: the second finger of a pinch-zoom arrives as its own touchstart
  // and cancels the swipe, so zooming in on a photo never flips to the next one.
  const onViewerTouchStart = (e: React.TouchEvent) => {
    const t = e.touches?.[0]
    touchStart.current = t && e.touches.length === 1 ? { x: t.clientX, y: t.clientY ?? 0 } : null
  }
  const onViewerTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    const end = e.changedTouches?.[0]
    if (!start || !end) return
    const dx = end.clientX - start.x
    const dy = (end.clientY ?? 0) - start.y
    // Mostly sideways, and far enough to be meant: a scroll-ish drag does nothing.
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) stepViewer(dx < 0 ? 1 : -1)
  }

  async function uploadFiles(files: File[], uploaderName: string) {
    const fail = (key: string, message?: string) =>
      setUploads((u) => u.map((x) => (x.key === key ? { ...x, status: 'error' as const, message } : x)))

    for (const file of files) {
      const key = `${file.name}-${Date.now()}-${Math.random()}`
      // Android pickers don't always honor accept=, so videos WILL be attempted at a wedding
      if (!file.type.startsWith('image/')) {
        setUploads((u) => [...u, { key, fileName: file.name, status: 'error', message: 'Only photos can be shared' }])
        continue
      }
      if (file.size > MAX_FILE_BYTES) {
        setUploads((u) => [...u, { key, fileName: `${file.name} (too large — 10MB max)`, status: 'error' }])
        continue
      }
      setUploads((u) => [...u, { key, fileName: file.name, status: 'uploading' }])
      try {
        const signRes = await fetch('/api/photos/sign', { method: 'POST' })
        if (signRes.status === 503) {
          setUploadsAvailable(false)
          fail(key)
          break // uploads are unavailable — don't re-hit sign for remaining files
        }
        if (signRes.status === 429) {
          fail(key, 'Too many uploads right now — try again in a few minutes')
          continue
        }
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
        if (!upRes.ok) {
          let detail: string | undefined
          try { detail = (await upRes.json())?.error?.message } catch { /* not JSON */ }
          fail(key, detail || 'Photo was rejected — try a smaller image')
          continue
        }
        const uploaded = await upRes.json()

        const recRes = await fetch('/api/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicId: uploaded.public_id, name: uploaderName, deviceId: getDeviceId() }),
        })
        if (!recRes.ok) throw new Error('record failed')
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, status: 'done' } : x)))
      } catch {
        fail(key)
      }
    }
    await refresh()
    // 'done' rows clear quickly; 'error' rows linger longer so guests have time to read them.
    setTimeout(() => setUploads((u) => u.filter((x) => x.status !== 'done')), 4000)
    setTimeout(() => setUploads((u) => u.filter((x) => x.status !== 'error')), 10000)
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
    if (pendingComment.current) {
      const { photoId, text } = pendingComment.current
      pendingComment.current = null
      submitComment(photoId, text, trimmed)
    }
  }

  const flipLike = (ps: Photo[], id: string) => ps.map((p) => p.id === id
    ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) }
    : p)

  async function toggleLike(photo: Photo) {
    if (likesInFlight.current.has(photo.id)) return
    likesInFlight.current.add(photo.id)
    setPendingLikes((p) => ({ ...p, [photo.id]: true }))
    setLikeError((e) => ({ ...e, [photo.id]: false }))
    setPhotos((ps) => flipLike(ps, photo.id)) // optimistic
    try {
      const res = await fetch(`/api/photos/${photo.id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: getDeviceId() }),
      })
      if (!res.ok) throw new Error(`like failed: ${res.status}`)
      const { liked, likeCount } = await res.json()
      setPhotos((ps) => ps.map((p) => (p.id === photo.id ? { ...p, likedByMe: liked, likeCount } : p)))
    } catch {
      // Undo the one heart in place and say so. A silent rollback — or, for a request
      // that never returned, a heart left lit that was never saved — both look like a
      // tap that did nothing, which is what Nicolle saw on her Android. Not refresh():
      // that would scroll a long gallery out from under whoever is browsing.
      setPhotos((ps) => flipLike(ps, photo.id))
      setLikeError((e) => ({ ...e, [photo.id]: true }))
    } finally {
      likesInFlight.current.delete(photo.id)
      setPendingLikes((p) => ({ ...p, [photo.id]: false }))
    }
  }

  async function submitComment(photoId: string, text: string, uploaderName: string) {
    if (pendingComments[photoId]) return
    setPendingComments((p) => ({ ...p, [photoId]: true }))
    try {
      const res = await fetch(`/api/photos/${photoId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: uploaderName, comment: text }),
      })
      if (!res.ok) throw new Error('comment failed')
      const { comment } = await res.json()
      setPhotos((ps) => ps.map((p) => (p.id === photoId ? { ...p, comments: [...p.comments, comment] } : p)))
      setCommentDrafts((d) => ({ ...d, [photoId]: '' }))
      setCommentError((e) => ({ ...e, [photoId]: false }))
    } catch {
      // keep the draft so the guest can retry
      setCommentError((e) => ({ ...e, [photoId]: true }))
    } finally {
      setPendingComments((p) => ({ ...p, [photoId]: false }))
    }
  }

  const startCaption = (photo: Photo) => {
    setEditingCaption(photo.id)
    setCaptionDraft(photo.caption ?? '')
    setCaptionError(false)
  }

  const saveCaption = async (photo: Photo) => {
    const caption = captionDraft.trim()
    setSavingCaption(true)
    setCaptionError(false)
    try {
      const res = await fetch(`/api/photos/${photo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption, deviceId: getDeviceId() }),
      })
      if (!res.ok) throw new Error('caption failed')
      const data = await res.json()
      // Patch the one row rather than refetching the gallery: a full refresh here
      // would scroll a long gallery out from under whoever just typed.
      setPhotos((ps) => ps.map((p) => (p.id === photo.id ? { ...p, caption: data.caption } : p)))
      setEditingCaption(null)
    } catch {
      setCaptionError(true)
    } finally {
      setSavingCaption(false)
    }
  }

  const deletePhoto = async (photo: Photo) => {
    if (!confirm('Delete this photo? This can’t be undone.')) return
    const prev = photos
    setPhotos((ps) => ps.filter((p) => p.id !== photo.id)) // optimistic
    try {
      const res = await fetch(`/api/photos/${photo.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: getDeviceId() }),
      })
      if (!res.ok) throw new Error('delete failed')
    } catch {
      setPhotos(prev) // revert
      alert('Sorry — that photo could not be deleted. Please try again.')
    }
  }

  async function addComment(photo: Photo) {
    const text = (commentDrafts[photo.id] ?? '').trim()
    if (!text) return
    if (!name) {
      pendingComment.current = { photoId: photo.id, text }
      setNamePrompt(true)
      return
    }
    await submitComment(photo.id, text, name)
  }

  return (
    <div className="min-h-screen bg-[#fdfcfb]">
      <header className="bg-[#00330a] text-white py-10 px-4 text-center">
        {/* A real link to "/", not history.back(). Most people reach this page by
            scanning the QR on a table card, so they arrive with no history to go back
            to — a back gesture would either do nothing or throw them out of the site
            entirely. Gold on the dark header, because the green underline link the
            other pages use would be invisible here. */}
        <div className="max-w-5xl mx-auto mb-8 text-left">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[#D4AF37] hover:text-white underline underline-offset-4 transition-colors"
          >
            <span aria-hidden="true">&larr;</span>
            Back to Wedding Website
          </Link>
        </div>
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
        <div className="max-w-3xl mx-auto mt-4 px-4 space-y-1" aria-live="polite">
          {uploads.map((u) => (
            <div key={u.key} className="flex items-center justify-between gap-3 text-sm bg-white rounded px-3 py-2 shadow">
              <span className="truncate">{u.fileName}</span>
              {u.status === 'uploading' && <span className="text-gray-500 shrink-0">Uploading…</span>}
              {u.status === 'done' && <span className="text-green-700 shrink-0">✓ Shared</span>}
              {u.status === 'error' && <span className="text-red-600 text-right">{u.message ?? 'Failed'}</span>}
            </div>
          ))}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-10">
        {loading ? (
          <p className="text-center text-gray-500">Loading photos…</p>
        ) : loadError ? (
          <div className="text-center text-gray-500">
            <p>Couldn&apos;t load photos — check your connection.</p>
            <button
              onClick={() => { setLoading(true); refresh() }}
              className="mt-3 bg-[#00330a] text-white px-6 py-2 rounded-full text-sm"
            >
              Retry
            </button>
          </div>
        ) : photos.length === 0 ? (
          <p className="text-center text-gray-500">No photos yet — be the first to share one!</p>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 [&>*]:mb-4">
            {photos.map((photo, i) => (
              <div key={photo.id} className="break-inside-avoid bg-white rounded-lg shadow overflow-hidden">
                <button
                  type="button"
                  onClick={(e) => { viewerOpener.current = e.currentTarget; setViewing(i) }}
                  className="block w-full cursor-zoom-in touch-manipulation"
                  aria-label={photo.caption ? `View full size: ${photo.caption}` : 'View full size'}
                >
                  {/* Cloudinary delivery URLs are dynamic; next/image needs remotePatterns config — plain img keeps it simple */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.thumbnailUrl ?? photo.fileUrl} alt={photo.caption ?? 'Wedding photo'} className="w-full" loading="lazy" />
                </button>
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">
                      {photo.uploadedByName ? `Shared by ${photo.uploadedByName}` : 'A wedding guest'}
                    </span>
                    <span className="flex items-center gap-3">
                      {/* Thumb-sized (44px) and touch-manipulation, so a tap on a phone lands
                          and fires once. The old 16px emoji was easy to miss with a thumb. */}
                      <button
                        type="button"
                        onClick={() => toggleLike(photo)}
                        aria-pressed={photo.likedByMe}
                        aria-busy={!!pendingLikes[photo.id]}
                        aria-label={photo.likedByMe ? 'Unlike photo' : 'Like photo'}
                        className="inline-flex items-center justify-center gap-1 min-w-[44px] min-h-[44px] -my-3 px-2 rounded-full text-sm touch-manipulation select-none active:bg-gray-100"
                      >
                        <HeartIcon filled={photo.likedByMe} />
                        {photo.likeCount > 0 ? photo.likeCount : ''}
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
                  </div>
                  {likeError[photo.id] && (
                    <p className="mt-1 text-xs text-red-600" role="alert">
                      Couldn&apos;t save your like — tap the heart to try again.
                    </p>
                  )}
                  {/* The caption, and the way to write one. Editing is offered only
                      on your own photos (or to an admin), matching who may delete. */}
                  {editingCaption === photo.id ? (
                    <div className="mt-2">
                      <textarea
                        value={captionDraft}
                        onChange={(e) => setCaptionDraft(e.target.value)}
                        maxLength={280}
                        rows={2}
                        autoFocus
                        aria-label="Photo caption"
                        placeholder="Say something about this photo…"
                        className="w-full border rounded px-2 py-1 text-sm"
                      />
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          onClick={() => saveCaption(photo)}
                          disabled={savingCaption}
                          className="text-xs bg-[#00330a] text-white px-3 py-1 rounded disabled:opacity-50"
                        >
                          {savingCaption ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingCaption(null)}
                          className="text-xs text-gray-600 underline"
                        >
                          Cancel
                        </button>
                        <span className="text-xs text-gray-400 ml-auto">{captionDraft.length}/280</span>
                      </div>
                      {captionError && (
                        <p className="mt-1 text-xs text-red-600">
                          That caption couldn&apos;t be saved — please try again.
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      {photo.caption && <p className="mt-1 text-sm text-gray-600">{photo.caption}</p>}
                      {(photo.mine || isAdmin) && (
                        <button
                          onClick={() => startCaption(photo)}
                          className="mt-1 text-xs text-[#00330a] underline"
                        >
                          {photo.caption ? 'Edit caption' : 'Add a caption'}
                        </button>
                      )}
                    </>
                  )}
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
                        <button
                          onClick={() => addComment(photo)}
                          disabled={!!pendingComments[photo.id]}
                          className="text-xs bg-[#00330a] text-white px-3 rounded disabled:opacity-60"
                        >
                          Post
                        </button>
                      </div>
                      {commentError[photo.id] && (
                        <p className="text-xs text-red-600">Couldn&apos;t post — try again</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {viewer && (
        <div
          className="fixed inset-0 z-50 bg-black/95 text-white flex flex-col"
          role="dialog" aria-modal="true" aria-label="Photo viewer"
          onClick={(e) => { if (e.target === e.currentTarget) closeViewer() }}
          onTouchStart={onViewerTouchStart}
          onTouchEnd={onViewerTouchEnd}
        >
          <div className="flex items-center justify-between p-2">
            <span className="text-sm px-2 text-white/80">{viewer.index + 1} / {photos.length}</span>
            <button
              type="button"
              onClick={closeViewer}
              autoFocus
              aria-label="Close"
              className="min-w-[44px] min-h-[44px] rounded-full text-3xl leading-none touch-manipulation hover:bg-white/10"
            >
              &times;
            </button>
          </div>
          {/* Tapping the dark space around the photo closes; tapping the photo does not,
              so a pinch-zoom or a mis-tap doesn't throw someone out. */}
          <div
            className="flex-1 min-h-0 flex items-center justify-center px-2"
            onClick={(e) => { if (e.target === e.currentTarget) closeViewer() }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={viewer.photo.id}
              src={viewer.photo.fileUrl}
              alt={viewer.photo.caption ?? 'Wedding photo, full size'}
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <div className="p-3 text-center text-sm">
            {viewer.photo.caption && <p>{viewer.photo.caption}</p>}
            <p className="text-white/70">
              {viewer.photo.uploadedByName ? `Shared by ${viewer.photo.uploadedByName}` : 'A wedding guest'}
            </p>
          </div>
          {viewer.index > 0 && (
            <button
              type="button"
              onClick={() => stepViewer(-1)}
              aria-label="Previous photo"
              className="absolute left-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] rounded-full bg-black/40 text-3xl leading-none touch-manipulation"
            >
              &lsaquo;
            </button>
          )}
          {viewer.index < photos.length - 1 && (
            <button
              type="button"
              onClick={() => stepViewer(1)}
              aria-label="Next photo"
              className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] rounded-full bg-black/40 text-3xl leading-none touch-manipulation"
            >
              &rsaquo;
            </button>
          )}
        </div>
      )}

      {namePrompt && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
          role="dialog" aria-modal="true" aria-labelledby="name-prompt-title"
        >
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h2 id="name-prompt-title" className="text-lg font-semibold text-[#00330a]">What&apos;s your name?</h2>
            <p className="text-sm text-gray-600 mt-1">So Emme &amp; Connor know who shared — we&apos;ll remember it on this device.</p>
            <input
              autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={100}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmName()
                if (e.key === 'Escape') { setNamePrompt(false); pendingFiles.current = null; pendingComment.current = null }
              }}
              className="mt-3 w-full border rounded px-3 py-2"
              placeholder="Your name"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setNamePrompt(false); pendingFiles.current = null; pendingComment.current = null }} className="px-4 py-2 text-sm text-gray-600">
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

// An SVG rather than the ❤️/🤍 pair: the white heart is a 2019 emoji that older
// Android fonts draw as a box, and on phones that do have it the two can look alike
// at 16px — so a like could succeed without ever looking like it did.
function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill={filled ? '#dc2626' : 'none'}
      stroke={filled ? '#dc2626' : '#374151'}
      strokeWidth="2"
      strokeLinejoin="round"
    >
      <path d="M12 21s-7-4.6-9.5-9.1C.8 8.6 2.4 4.9 6 4.2c2-.4 4 .5 6 2.7 2-2.2 4-3.1 6-2.7 3.6.7 5.2 4.4 3.5 7.7C19 16.4 12 21 12 21z" />
    </svg>
  )
}
