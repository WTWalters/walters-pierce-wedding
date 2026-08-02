'use client'

import { useEffect, useState } from 'react'

interface Contribution {
  id: string; contributorName: string; contributorEmail: string; tierTitle: string
  giftDescription: string | null
  amount: number; message: string | null; paymentStatus: string | null; thankYouSent: boolean
  source: string | null; createdAt: string
}
const EMPTY_GIFT = { contributorName: '', contributorEmail: '', giftDescription: '', amount: '', givenOn: '' }

// The <input type="date"> wants yyyy-mm-dd in local time. Reading it off the ISO
// string would shift the day for anyone behind UTC.
const dateInputValue = (iso: string) => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
interface TierSummary {
  id: string; title: string; targetAmount: number; amountRaised: number; isActive: boolean
}

export default function AdminRegistryPage() {
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [tiers, setTiers] = useState<TierSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newGift, setNewGift] = useState(EMPTY_GIFT)
  // null = the form is adding; an id = editing that gift. One form for both, so the
  // fields and validation can't drift apart.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = () => fetch('/api/admin/registry').then((r) => r.json()).then((d) => {
    setContributions(d.contributions || []); setTiers(d.tiers || []); setLoading(false)
  })
  useEffect(() => { load() }, [])

  const total = contributions.reduce((s, c) => s + c.amount, 0)

  const closeForm = () => {
    setShowAdd(false); setEditingId(null); setNewGift(EMPTY_GIFT)
  }

  const startEdit = (c: Contribution) => {
    setEditingId(c.id)
    setNewGift({
      contributorName: c.contributorName,
      contributorEmail: c.contributorEmail,
      giftDescription: c.giftDescription ?? '',
      // Blank rather than "0", so a present opens with an empty Amount box.
      amount: c.amount > 0 ? String(c.amount) : '',
      givenOn: dateInputValue(c.createdAt),
    })
    setShowAdd(true)
    setMessage('')
  }

  const saveGift = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setMessage('')
    try {
      const res = await fetch(
        editingId ? `/api/admin/registry/gifts/${editingId}` : '/api/admin/registry/gifts',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newGift),
        }
      )
      const data = await res.json().catch(() => null)
      if (!res.ok) { setMessage(`❌ ${data?.error ?? 'Could not save the gift'}`); return }
      setMessage(editingId ? '✅ Gift updated' : '✅ Gift recorded')
      closeForm()
      await load()
    } catch {
      setMessage('❌ Could not save the gift')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="py-12 text-center text-gray-600">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Registry &amp; Gifts</h1>
        <div className="flex gap-3">
          <button
            onClick={() => (showAdd ? closeForm() : setShowAdd(true))}
            className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
          >
            ➕ Add a gift
          </button>
          <a href="/api/admin/registry/export" className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">Download CSV</a>
        </div>
      </div>

      {message && <div className="text-sm text-gray-700">{message}</div>}

      {/* For gifts that never went through the Honeymoon Fund — cash, a cheque, a
          present. These carry no tier, so they can't move the public page's numbers. */}
      {showAdd && (
        <form onSubmit={saveGift} className="bg-white rounded-lg shadow p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">{editingId ? 'Edit this gift' : 'Record a gift'}</h3>
            <p className="text-sm text-gray-600 mt-1">
              For anything that didn&rsquo;t come through the Honeymoon Fund page. Leave
              the amount blank for a present &mdash; no figure is shown anywhere for it.
              Describe the gift how you&rsquo;d like it thanked (&ldquo;beautiful cake
              serving set&rdquo;, &ldquo;helping with our AirBNB&rdquo;).
            </p>
            {!editingId && (
              <p className="text-sm text-gray-600 mt-2">
                Gave more than one thing? <strong>Add each gift separately.</strong> One
                Thank You note acknowledges all of them together &mdash; &ldquo;thank you for
                the beautiful cake serving set, as well as $100 toward our AirBNB&rdquo;.
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="text-sm">
              <span className="block text-gray-700 mb-1">Name *</span>
              <input
                required
                value={newGift.contributorName}
                onChange={(e) => setNewGift({ ...newGift, contributorName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </label>
            <label className="text-sm">
              <span className="block text-gray-700 mb-1">Email</span>
              <input
                type="email"
                placeholder="optional — needed to send a thank-you"
                value={newGift.contributorEmail}
                onChange={(e) => setNewGift({ ...newGift, contributorEmail: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </label>
            <label className="text-sm">
              <span className="block text-gray-700 mb-1">Gift</span>
              <input
                placeholder="e.g. cheque, cash, crystal bowl"
                value={newGift.giftDescription}
                onChange={(e) => setNewGift({ ...newGift, giftDescription: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </label>
            <label className="text-sm">
              <span className="block text-gray-700 mb-1">Amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="blank for a present"
                value={newGift.amount}
                onChange={(e) => setNewGift({ ...newGift, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </label>
            <label className="text-sm">
              <span className="block text-gray-700 mb-1">Date</span>
              <input
                type="date"
                value={newGift.givenOn}
                onChange={(e) => setNewGift({ ...newGift, givenOn: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </label>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save gift'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="bg-gray-200 text-gray-800 px-6 py-2 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-900">${total.toLocaleString('en-US')}</div>
          <div className="text-green-800 text-sm">Total raised</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-900">{contributions.length}</div>
          <div className="text-blue-800 text-sm">Gifts</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-3">By tier</h3>
        <div className="space-y-2">
          {tiers.map((t) => {
            const gifts = contributions.filter((c) => c.tierTitle === t.title).length
            return (
              <div key={t.id} className="flex justify-between text-sm border-b border-gray-100 py-2">
                <span>{t.title}{!t.isActive && <span className="text-gray-400"> (inactive)</span>}</span>
                <span className="text-gray-700">${t.amountRaised.toLocaleString('en-US')} Raised · {gifts} guest{gifts === 1 ? '' : 's'}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-lg font-semibold">Contributions</h3></div>
        {/* Nicolle: "needs to have a wider viewing field" — the Date column was
            clipped off the right edge. Beyond widening the admin container, this
            table gives back its own width: tighter cell padding, a one-line
            "Thanked" header instead of "THANK-/YOU" wrapping, and the two long text
            columns allowed to wrap rather than forcing the table wider than the
            screen. overflow-x-auto stays as the fallback at narrow widths. */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Gift', 'Amount', 'Message', 'Thanked', 'Date', ''].map((h, i) => (
                  <th key={h || `actions-${i}`} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contributions.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-3 py-4 text-sm">
                    <div className="font-medium text-gray-900">{c.contributorName}</div>
                    <div className="text-gray-500 break-all">{c.contributorEmail || '— no email —'}</div>
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-900">
                    {c.tierTitle}
                    {c.source === 'manual' && (
                      <span className="ml-2 inline-block bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-xs whitespace-nowrap">
                        Added by you
                      </span>
                    )}
                  </td>
                  {/* A present has no amount — showing "$0" for a cake serving set is
                      exactly what Nicolle objected to. */}
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {c.amount > 0 ? `$${c.amount.toLocaleString('en-US')}` : '—'}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-600 max-w-[18rem]">{c.message || '—'}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-center">{c.thankYouSent ? '✅' : '—'}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(c.createdAt).toLocaleDateString('en-US')}</td>
                  {/* Only gifts she recorded are editable — a Stripe gift's amount is
                      tied to a real payment. The route enforces this too. */}
                  <td className="px-3 py-4 whitespace-nowrap text-sm">
                    {c.source === 'manual' && (
                      <button
                        onClick={() => startEdit(c)}
                        className="text-green-700 hover:text-green-900 underline"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {contributions.length === 0 && <div className="text-center py-12 text-gray-500">No gifts yet.</div>}
        </div>
      </div>
    </div>
  )
}
