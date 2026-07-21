'use client'

import { useState, useEffect, useCallback } from 'react'
import { deriveEmailStatus, emailTypeLabel, EMAIL_STATUS_META } from '@/lib/email-status'

interface EmailRow {
  id: string
  recipientEmail: string
  emailType: string | null
  subject: string | null
  sentAt: string
  status: string | null
  openedAt: string | null
  bouncedAt: string | null
  clickedAt: string | null
  guestName: string | null
}

interface Stats {
  sent: number; delivered: number; opened: number; openRate: number
  bounced: number; failed: number; complained: number
}

const TILES: Array<{ key: keyof Stats; label: string }> = [
  { key: 'sent', label: 'Sent' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'opened', label: 'Opened' },
  { key: 'bounced', label: 'Bounced' },
  { key: 'failed', label: 'Failed' },
  { key: 'complained', label: 'Spam' },
]

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Denver',
  })
}

export default function EmailsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [emails, setEmails] = useState<EmailRow[]>([])
  const [capped, setCapped] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [recipientQuery, setRecipientQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState('')
  // Every type present, sourced from the (unfiltered) stats endpoint — so the
  // dropdown never collapses to just the currently-selected type.
  const [availableTypes, setAvailableTypes] = useState<string[]>([])

  const load = useCallback(async (type: string) => {
    setLoading(true)
    setError('')
    try {
      const q = type ? `?type=${encodeURIComponent(type)}` : ''
      const [sRes, eRes] = await Promise.all([
        fetch('/api/admin/email/stats'),
        fetch(`/api/admin/emails${q}`),
      ])
      if (!sRes.ok || !eRes.ok) throw new Error('load failed')
      const s = await sRes.json()
      const e = await eRes.json()
      setStats(s)
      setAvailableTypes(Array.isArray(s.types) ? s.types : [])
      setEmails(e.emails)
      setCapped(e.capped)
      setUpdatedAt(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
    } catch {
      // Keep the currently-shown data; just surface a friendly message.
      setError("Couldn't load the latest email data. Try Refresh.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(typeFilter) }, [load, typeFilter])

  // Client-side recipient search over the loaded rows (name or email).
  const q = recipientQuery.trim().toLowerCase()
  const visibleEmails = q
    ? emails.filter((e) =>
        e.recipientEmail.toLowerCase().includes(q) || (e.guestName ?? '').toLowerCase().includes(q))
    : emails

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-[#00330a]">Emails</h1>
        <div className="flex items-center gap-3">
          {updatedAt && <span className="text-sm text-gray-500">Updated {updatedAt}</span>}
          <button
            onClick={() => load(typeFilter)}
            disabled={loading}
            className="px-4 py-2 rounded bg-[#00330a] text-white text-sm disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 text-sm text-red-700 bg-red-50 rounded px-3 py-2">{error}</div>}

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {TILES.map(({ key, label }) => (
          <div key={key} className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-[#00330a]">{stats ? stats[key] : '—'}</div>
            <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
            {key === 'opened' && stats && (
              <div className="text-xs text-gray-500 mt-1">{stats.openRate}% open rate</div>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 -mt-4 mb-6">Totals across all emails — not affected by the filter below.</p>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-3">
        <label className="text-sm text-gray-600">Filter by type</label>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
        >
          <option value="">All types</option>
          {availableTypes.map((t) => <option key={t} value={t}>{emailTypeLabel(t)}</option>)}
        </select>
        <input
          type="search"
          value={recipientQuery}
          onChange={(e) => setRecipientQuery(e.target.value)}
          placeholder="Search recipient (name or email)…"
          className="px-3 py-2 border border-gray-300 rounded-md text-sm w-64 focus:outline-none focus:ring-2 focus:ring-green-600"
        />
        {capped && <span className="text-xs text-gray-500">Showing the latest 500</span>}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Recipient', 'Type', 'Subject', 'Sent', 'Status'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {visibleEmails.map((e) => {
              const st = deriveEmailStatus(e)
              const meta = EMAIL_STATUS_META[st]
              return (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {e.guestName && <div className="font-medium">{e.guestName}</div>}
                    <div className="text-gray-500">{e.recipientEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{emailTypeLabel(e.emailType)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{e.subject ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{fmtDate(e.sentAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs ${meta.className}`}>{meta.label}</span>
                  </td>
                </tr>
              )
            })}
            {visibleEmails.length === 0 && !loading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                {emails.length === 0 ? 'No emails yet.' : 'No emails match that recipient.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
