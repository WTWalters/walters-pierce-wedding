// app/(public)/photos/page.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  const [commentError, setCommentError] = useState<Record<string, boolean>>({})
  const fileInput = useRef<HTMLInputElement>(null)
  const pendingFiles = useRef<File[] | null>(null)
  const pendingComment = useRef<{ photoId: string; text: string } | null>(null)

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

  async function toggleLike(photo: Photo) {
    if (pendingLikes[photo.id]) return
    setPendingLikes((p) => ({ ...p, [photo.id]: true }))
    // optimistic
    setPhotos((ps) => ps.map((p) => p.id === photo.id
      ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) }
      : p))
    try {
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
    } finally {
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
