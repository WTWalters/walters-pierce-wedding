'use client'

import { useCallback, useEffect, useState } from 'react'
import { MessageToSend } from '@/components/admin/MessageToSend'

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
  const [viewFor, setViewFor] = useState<Submission | null>(null)
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
                      <button disabled={busyId === s.id} onClick={() => setViewFor(s)} className="px-2 py-1 rounded border border-gray-400 text-gray-700 text-xs disabled:opacity-50">View</button>
                      <button disabled={busyId === s.id} onClick={() => approve(s)} className="px-2 py-1 rounded bg-[#00330a] text-white text-xs disabled:opacity-50">Approve</button>
                      <button disabled={busyId === s.id} onClick={() => openMatch(s)} className="px-2 py-1 rounded bg-amber-600 text-white text-xs disabled:opacity-50">Match</button>
                      <MessageToSend guestId={s.id} email={s.email} onSent={refresh} />
                      <button disabled={busyId === s.id} onClick={() => remove(s)} className="px-2 py-1 rounded bg-red-600 text-white text-xs disabled:opacity-50">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-[#00330a]">Submission details</h2>
              <button onClick={() => setViewFor(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <dl className="text-sm space-y-2">
              <div><dt className="text-gray-500">Name</dt><dd className="font-medium text-gray-900">{viewFor.firstName} {viewFor.lastName}</dd></div>
              <div><dt className="text-gray-500">Email</dt><dd>{viewFor.email}</dd></div>
              <div><dt className="text-gray-500">Attending</dt><dd>{viewFor.attending ? 'Yes' : viewFor.attending === false ? 'No' : '—'}</dd></div>
              <div><dt className="text-gray-500">Party count</dt><dd>{viewFor.rsvpdCount ?? '—'}</dd></div>
              <div><dt className="text-gray-500">Dietary</dt><dd>{viewFor.dietaryRestrictions || '—'}</dd></div>
              <div><dt className="text-gray-500">Song request</dt><dd>{viewFor.songRequest || '—'}</dd></div>
              <div><dt className="text-gray-500">Submitted</dt><dd>{viewFor.rsvpReceivedAt ? new Date(viewFor.rsvpReceivedAt).toLocaleString() : '—'}</dd></div>
            </dl>
            <div className="mt-4 text-right">
              <button onClick={() => setViewFor(null)} className="px-4 py-2 rounded bg-gray-200 text-gray-800 text-sm">Close</button>
            </div>
          </div>
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
    // PUT /api/admin/rsvps expects a flat body ({ date, time, venueName, venueAddress }),
    // not { details: {...} } — confirmed against app/api/admin/rsvps/route.ts.
    const res = await fetch('/api/admin/rsvps', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(details),
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
