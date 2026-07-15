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

  // Run a moderation mutation, then re-pull authoritative state. Surfaces a
  // message on failure so a silently-failed hide/delete can't look like success.
  async function mutate(url: string, init: RequestInit) {
    try {
      const res = await fetch(url, init)
      if (!res.ok) throw new Error('request failed')
      setError('')
    } catch {
      setError('That action didn’t go through — please try again.')
    } finally {
      refresh()
    }
  }

  async function setPhotoHidden(id: string, isHidden: boolean) {
    await mutate(`/api/admin/photos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isHidden }),
    })
  }

  async function deletePhoto(id: string) {
    if (!confirm('Permanently delete this photo (including from Cloudinary)? This cannot be undone.')) return
    await mutate(`/api/admin/photos/${id}`, { method: 'DELETE' })
  }

  async function setCommentHidden(photoId: string, commentId: string, isHidden: boolean) {
    await mutate(`/api/admin/photos/${photoId}/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isHidden }),
    })
  }

  async function deleteComment(photoId: string, commentId: string) {
    if (!confirm('Permanently delete this comment?')) return
    await mutate(`/api/admin/photos/${photoId}/comments/${commentId}`, { method: 'DELETE' })
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
