'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

interface EmailLogEntry {
  emailType: string
  status: string | null
  sentAt: string
  openedAt: string | null
  bouncedAt: string | null
}

interface GuestRow {
  id: string
  firstName: string
  lastName: string
  email: string
  attending: boolean | null
  partySize: number | null
  dietaryRestrictions: string | null
  songRequest: string | null
  source: string
  rsvpReceivedAt: string | null
  emailLogs: EmailLogEntry[]
}

interface Details { date: string; time: string; venueName: string; venueAddress: string }

const BUCKETS = [
  { key: 'matched-yes', label: 'Matched — Attending', filter: (g: GuestRow) => g.source === 'imported' && g.attending === true },
  { key: 'unmatched-yes', label: 'Unmatched — Attending (review!)', filter: (g: GuestRow) => g.source === 'self_rsvp' && g.attending === true },
  { key: 'matched-no', label: 'Matched — Declined', filter: (g: GuestRow) => g.source === 'imported' && g.attending === false },
  { key: 'unmatched-no', label: 'Unmatched — Declined', filter: (g: GuestRow) => g.source === 'self_rsvp' && g.attending === false },
] as const

export default function AdminRsvpsPage() {
  const [guests, setGuests] = useState<GuestRow[]>([])
  const [details, setDetails] = useState<Details>({ date: '', time: '', venueName: '', venueAddress: '' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [template, setTemplate] = useState<'venue_details' | 'gracious_regrets'>('venue_details')
  const [preview, setPreview] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/rsvps')
    if (res.ok) {
      const data = await res.json()
      setGuests(data.guests)
      setDetails(data.details)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const responded = useMemo(() => guests.filter((g) => g.rsvpReceivedAt), [guests])
  const awaiting = useMemo(() => guests.filter((g) => !g.rsvpReceivedAt && g.source === 'imported'), [guests])
  const headcount = useMemo(
    () => responded.filter((g) => g.attending).reduce((sum, g) => sum + (g.partySize ?? 1), 0),
    [responded]
  )

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const saveDetails = async () => {
    const res = await fetch('/api/admin/rsvps', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(details),
    })
    setStatusMsg(res.ok ? 'Wedding details saved.' : 'Failed to save details.')
  }

  const doPreview = async () => {
    const res = await fetch('/api/admin/rsvps/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestIds: [...selected], template, dryRun: true }),
    })
    if (res.ok) {
      const data = await res.json()
      setPreview(data.preview.html)
    }
  }

  const doSend = async () => {
    if (!selected.size) return
    if (!window.confirm(`Send "${template.replace('_', ' ')}" to ${selected.size} guest(s)?`)) return
    setSending(true)
    setStatusMsg('Sending — this can take a minute for larger groups…')
    try {
      const res = await fetch('/api/admin/rsvps/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestIds: [...selected], template }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatusMsg(data.error || 'Send failed.')
        return
      }
      const ok = data.results.filter((r: { success: boolean }) => r.success).length
      const failed = data.results.length - ok
      setStatusMsg(`Sent ${ok} email(s)${failed ? `, ${failed} FAILED — check the log column and re-select those guests` : ''}.`)
      setSelected(new Set())
      setPreview(null)
      await load()
    } finally {
      setSending(false)
    }
  }

  const lastSend = (g: GuestRow) => {
    const log = g.emailLogs[0]
    if (!log) return '—'
    const flags = [
      log.status === 'failed' ? '❌ failed' : '✉️ sent',
      log.openedAt ? '👁 opened' : null,
      log.bouncedAt ? '⚠️ bounced' : null,
    ].filter(Boolean).join(' · ')
    return `${log.emailType.replace('gated_', '')} — ${flags}`
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-serif text-[#00330a] mb-1">RSVPs &amp; Communications</h1>
      <p className="text-gray-600 mb-6">
        {responded.length} responses · expected headcount {headcount} · {awaiting.length} invited, not yet responded
      </p>

      <section className="mb-8 rounded border border-[#D4AF37]/50 bg-white p-4">
        <h2 className="font-medium text-[#00330a] mb-3">Wedding details (only ever revealed via the gated email)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {(['date', 'time', 'venueName', 'venueAddress'] as const).map((field) => (
            <input key={field} value={details[field]} placeholder={field}
              onChange={(e) => setDetails({ ...details, [field]: e.target.value })}
              className="rounded border-gray-300 text-sm" />
          ))}
        </div>
        <button onClick={saveDetails} className="mt-3 rounded bg-[#00330a] px-4 py-2 text-white text-sm">
          Save details
        </button>
      </section>

      <section className="mb-6 flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-white p-4">
        <span className="text-sm text-gray-700">{selected.size} selected</span>
        <select value={template} onChange={(e) => setTemplate(e.target.value as typeof template)}
          className="rounded border-gray-300 text-sm">
          <option value="venue_details">Venue details (date/time/venue)</option>
          <option value="gracious_regrets">Gracious regrets</option>
        </select>
        <button onClick={doPreview} disabled={!selected.size}
          className="rounded border border-[#00330a] px-4 py-2 text-sm text-[#00330a] disabled:opacity-50">
          Preview
        </button>
        <button onClick={doSend} disabled={!selected.size || sending}
          className="rounded bg-[#00330a] px-4 py-2 text-sm text-white disabled:opacity-50">
          {sending ? 'Sending…' : 'Send to selected'}
        </button>
        <button
          onClick={() => {
            const songs = responded
              .filter((g) => g.attending && g.songRequest)
              .map((g) => `${g.songRequest} — requested by ${g.firstName} ${g.lastName}`)
              .join('\n')
            navigator.clipboard.writeText(songs)
            setStatusMsg(songs ? 'Song list copied to clipboard.' : 'No song requests yet.')
          }}
          className="rounded border border-[#D4AF37] px-4 py-2 text-sm text-[#00330a]">
          Copy song list 🎵
        </button>
        {statusMsg && <span className="text-sm text-gray-700" role="status">{statusMsg}</span>}
      </section>

      {BUCKETS.map((bucket) => {
        const rows = responded.filter(bucket.filter)
        return (
          <section key={bucket.key} className="mb-8">
            <h2 className="font-medium text-[#00330a] mb-2">{bucket.label} ({rows.length})</h2>
            {rows.length === 0 ? (
              <p className="text-sm text-gray-500">None yet.</p>
            ) : (
              <div className="overflow-x-auto rounded border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-600">
                    <tr>
                      <th className="p-2 w-8"></th>
                      <th className="p-2">Name</th>
                      <th className="p-2">Email</th>
                      <th className="p-2">Party</th>
                      <th className="p-2">Dietary</th>
                      <th className="p-2">Song</th>
                      <th className="p-2">RSVP&apos;d</th>
                      <th className="p-2">Last email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((g) => (
                      <tr key={g.id} className="border-t border-gray-100">
                        <td className="p-2">
                          <input type="checkbox" checked={selected.has(g.id)} onChange={() => toggle(g.id)}
                            aria-label={`Select ${g.firstName} ${g.lastName}`} />
                        </td>
                        <td className="p-2">{g.firstName} {g.lastName}</td>
                        <td className="p-2">{g.email}</td>
                        <td className="p-2">{g.partySize ?? '—'}</td>
                        <td className="p-2">{g.dietaryRestrictions || '—'}</td>
                        <td className="p-2">{g.songRequest || '—'}</td>
                        <td className="p-2">{g.rsvpReceivedAt ? new Date(g.rsvpReceivedAt).toLocaleDateString() : '—'}</td>
                        <td className="p-2">{lastSend(g)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPreview(null)}>
          <div className="max-h-[80vh] max-w-2xl w-full overflow-auto rounded bg-white p-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex justify-between">
              <strong>Preview (first selected guest)</strong>
              <button onClick={() => setPreview(null)} className="text-gray-500">✕ close</button>
            </div>
            <iframe srcDoc={preview} className="h-[60vh] w-full border" title="Email preview" />
          </div>
        </div>
      )}
    </div>
  )
}
