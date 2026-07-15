'use client'

import { useEffect, useState } from 'react'
import { isVariable } from '@/lib/registry'

interface Tier {
  id: string
  title: string
  description: string | null
  imageUrl: string | null
  category: string
  targetAmount: number
  amountRaised: number
}

export default function RegistryPage() {
  const [tiers, setTiers] = useState<Tier[]>([])
  const [active, setActive] = useState<Tier | null>(null)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/registry').then((r) => r.json()).then((d) => setTiers(d.items || []))
  }, [])

  const open = (t: Tier) => { setActive(t); setName(''); setMessage(''); setAmount(''); setError('') }

  const gift = async () => {
    if (!active) return
    setError(''); setBusy(true)
    try {
      const res = await fetch('/api/registry/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registryItemId: active.id,
          name,
          message: message || undefined,
          amount: isVariable(active.category) ? Number(amount) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setBusy(false); return }
      window.location.href = data.url
    } catch {
      setError('Something went wrong — please try again.'); setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFDF7] py-16 px-6">
      <div className="max-w-5xl mx-auto text-center">
        <h1 className="text-4xl font-serif text-[#00330a] mb-3">Honeymoon Fund</h1>
        <p className="text-gray-700 max-w-2xl mx-auto mb-2">
          Emme &amp; Connor are honeymooning in Ireland. If you&apos;d like to help them celebrate,
          a gift toward the trip would mean the world.
        </p>
        <p className="text-sm text-gray-500 mb-12">These are gifts toward the honeymoon, not tax-deductible donations.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
          {tiers.map((t) => {
            return (
              <div key={t.id} className="bg-white border border-[#D4AF37]/40 rounded-lg p-6 flex flex-col shadow-sm">
                {t.imageUrl && <img src={t.imageUrl} alt="" className="w-full h-40 object-cover rounded-md mb-4" />}
                <h3 className="text-xl font-serif text-[#00330a]">{t.title}</h3>
                {t.description && <p className="text-sm text-gray-600 mt-1 flex-1">{t.description}</p>}
                <div className="mt-4">
                  {isVariable(t.category)
                    ? <p className="text-[#00330a] font-semibold">Choose an amount</p>
                    : <p className="text-[#00330a] font-semibold">${t.targetAmount.toLocaleString('en-US')}</p>}
                </div>
                <button onClick={() => open(t)}
                  className="mt-5 bg-[#00330a] text-white py-2 rounded-md hover:bg-[#004d0f] transition-colors">
                  Gift this
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {active && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-serif text-[#00330a]">{active.title}</h3>
              <button onClick={() => setActive(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <label className="block text-sm text-gray-700 mb-1">Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-[#00330a]" />
            {isVariable(active.category) && (
              <>
                <label className="block text-sm text-gray-700 mb-1">Amount (USD)</label>
                <div className="flex gap-2 mb-2">
                  {['50', '100'].map((preset) => (
                    <button key={preset} type="button" onClick={() => setAmount(preset)}
                      className={`flex-1 py-2 rounded-md border text-sm transition-colors ${
                        amount === preset
                          ? 'bg-[#00330a] text-white border-[#00330a]'
                          : 'border-gray-300 text-gray-700 hover:border-[#00330a]'
                      }`}>
                      ${preset}
                    </button>
                  ))}
                </div>
                <input type="number" min={5} value={amount} placeholder="Or enter a custom amount"
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-[#00330a]" />
              </>
            )}
            <label className="block text-sm text-gray-700 mb-1">Message to the couple (optional)</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-[#00330a]" />
            {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
            <button disabled={busy || !name.trim()} onClick={gift}
              className="w-full bg-[#00330a] text-white py-2 rounded-md hover:bg-[#004d0f] transition-colors disabled:opacity-50">
              {busy ? 'Redirecting…' : 'Continue to payment'}
            </button>
            <p className="text-xs text-gray-400 mt-3 text-center">Secure payment via Stripe.</p>
          </div>
        </div>
      )}
    </div>
  )
}
