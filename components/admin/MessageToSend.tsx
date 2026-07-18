'use client'

import { useState } from 'react'

type Template = 'rsvp_yes' | 'rsvp_no' | 'rsvp_over_count'
const OPTIONS: { value: Template; label: string; confirm: string }[] = [
  { value: 'rsvp_yes', label: 'RSVP Yes', confirm: 'the “you’re locked in” confirmation (with venue)' },
  { value: 'rsvp_no', label: 'RSVP No', confirm: 'the “sorry to miss you” note' },
  { value: 'rsvp_over_count', label: 'Incorrect RSVP', confirm: 'the “too many guests” note' },
]

export function MessageToSend({ guestId, email, onSent }: { guestId: string; email: string | null; onSent?: () => void }) {
  const [template, setTemplate] = useState<Template | ''>('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function send() {
    if (!template) return
    if (!email) { setMsg('No email on file'); return }
    const opt = OPTIONS.find((o) => o.value === template)!
    if (!confirm(`Send ${opt.confirm} to ${email}?`)) return
    setBusy(true); setMsg('')
    try {
      const res = await fetch('/api/admin/rsvps/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestIds: [guestId], template }),
      })
      if (!res.ok) throw new Error()
      setMsg('Sent ✓'); setTemplate(''); onSent?.()
    } catch { setMsg('Failed') } finally { setBusy(false) }
  }

  return (
    <div className="flex items-center gap-1">
      <select
        value={template}
        onChange={(e) => setTemplate(e.target.value as Template | '')}
        className="border rounded px-1 py-1 text-xs"
        aria-label="Message to send"
      >
        <option value="">Message…</option>
        {OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button disabled={!template || busy} onClick={send}
        className="px-2 py-1 rounded bg-[#00330a] text-white text-xs disabled:opacity-40">Send</button>
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
    </div>
  )
}
