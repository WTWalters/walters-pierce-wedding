'use client'

import { useEffect, useState } from 'react'

interface Contribution {
  id: string; contributorName: string; contributorEmail: string; tierTitle: string
  amount: number; message: string | null; paymentStatus: string | null; thankYouSent: boolean; createdAt: string
}
interface TierSummary {
  id: string; title: string; targetAmount: number; amountRaised: number; isActive: boolean
}

export default function AdminRegistryPage() {
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [tiers, setTiers] = useState<TierSummary[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => fetch('/api/admin/registry').then((r) => r.json()).then((d) => {
    setContributions(d.contributions || []); setTiers(d.tiers || []); setLoading(false)
  })
  useEffect(() => { load() }, [])

  const total = contributions.reduce((s, c) => s + c.amount, 0)

  if (loading) return <div className="py-12 text-center text-gray-600">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Registry &amp; Gifts</h1>
        <a href="/api/admin/registry/export" className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">Download CSV</a>
      </div>

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
          {tiers.map((t) => (
            <div key={t.id} className="flex justify-between text-sm border-b border-gray-100 py-2">
              <span>{t.title}{!t.isActive && <span className="text-gray-400"> (inactive)</span>}</span>
              <span className="text-gray-700">${t.amountRaised.toLocaleString('en-US')} raised · target ${t.targetAmount.toLocaleString('en-US')}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-lg font-semibold">Contributions</h3></div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Gift', 'Amount', 'Message', 'Thank-you', 'Date'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contributions.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="font-medium text-gray-900">{c.contributorName}</div>
                    <div className="text-gray-500">{c.contributorEmail}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{c.tierTitle}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${c.amount.toLocaleString('en-US')}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{c.message || '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{c.thankYouSent ? '✅' : '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(c.createdAt).toLocaleDateString('en-US')}</td>
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
