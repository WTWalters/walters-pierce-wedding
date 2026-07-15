'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RSVPPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [attending, setAttending] = useState<boolean | null>(null)
  const [partySize, setPartySize] = useState(1)
  const [dietaryRestrictions, setDietaryRestrictions] = useState('')
  const [songRequest, setSongRequest] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState<null | { attending: boolean }>(null)

  // After the thank-you shows, attending guests are ushered to the honeymoon
  // fund; decliners drift back to the homepage.
  useEffect(() => {
    if (!submitted) return
    const dest = submitted.attending ? '/registry' : '/'
    const delay = submitted.attending ? 4000 : 7000
    const timer = setTimeout(() => router.push(dest), delay)
    return () => clearTimeout(timer)
  }, [submitted, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (attending === null) {
      setError('Please let us know whether you can join us.')
      return
    }
    setIsLoading(true)
    try {
      const response = await fetch('/api/rsvp/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          attending,
          partySize: attending ? partySize : undefined,
          dietaryRestrictions: dietaryRestrictions.trim() || undefined,
          songRequest: songRequest.trim() || undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Something went wrong — please try again.')
        return
      }
      setSubmitted({ attending })
    } catch {
      setError('Something went wrong — please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#FFFDF7] py-16 px-4">
      <div className="max-w-xl mx-auto">
        <h1 className="font-serif text-4xl text-center text-[#00330a] mb-2">RSVP</h1>
        <p className="text-center text-gray-600 mb-3">
          Emme &amp; Connor — September 2026
        </p>
        <p className="text-center mb-10">
          <a href="/registry" className="text-sm text-[#00330a] underline decoration-[#D4AF37] underline-offset-4 hover:text-[#004d10] transition">
            Visit our Honeymoon Fund →
          </a>
        </p>

        <form onSubmit={handleSubmit} className="space-y-6 bg-white border border-[#D4AF37]/40 rounded-lg p-8 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm text-[#00330a] font-medium">First name *</span>
              <input required value={firstName} onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full rounded border-gray-300 focus:border-[#00330a] focus:ring-[#00330a]" />
            </label>
            <label className="block">
              <span className="text-sm text-[#00330a] font-medium">Last name *</span>
              <input required value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full rounded border-gray-300 focus:border-[#00330a] focus:ring-[#00330a]" />
            </label>
          </div>

          <label className="block">
            <span className="text-sm text-[#00330a] font-medium">Email *</span>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border-gray-300 focus:border-[#00330a] focus:ring-[#00330a]" />
          </label>

          <fieldset>
            <legend className="text-sm text-[#00330a] font-medium mb-2">Will you be joining us? *</legend>
            <div className="flex gap-3">
              <button type="button" onClick={() => setAttending(true)} aria-pressed={attending === true}
                className={`flex-1 rounded border px-4 py-3 text-sm font-medium transition
                  ${attending === true ? 'bg-[#00330a] text-white border-[#00330a]' : 'border-gray-300 text-gray-700 hover:border-[#00330a]'}`}>
                Joyfully accepts
              </button>
              <button type="button" onClick={() => setAttending(false)} aria-pressed={attending === false}
                className={`flex-1 rounded border px-4 py-3 text-sm font-medium transition
                  ${attending === false ? 'bg-[#00330a] text-white border-[#00330a]' : 'border-gray-300 text-gray-700 hover:border-[#00330a]'}`}>
                Regretfully declines
              </button>
            </div>
          </fieldset>

          {attending === true && (
            <>
              <label className="block">
                <span className="text-sm text-[#00330a] font-medium">Number of guests (including you) *</span>
                <select value={partySize} onChange={(e) => setPartySize(Number(e.target.value))}
                  className="mt-1 w-full rounded border-gray-300 focus:border-[#00330a] focus:ring-[#00330a]">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm text-[#00330a] font-medium">Dietary restrictions</span>
                <textarea rows={2} value={dietaryRestrictions} onChange={(e) => setDietaryRestrictions(e.target.value)}
                  placeholder="Anything we should know for your party?"
                  className="mt-1 w-full rounded border-gray-300 focus:border-[#00330a] focus:ring-[#00330a]" />
              </label>
              <label className="block">
                <span className="text-sm text-[#00330a] font-medium">Favorite song — we&apos;ll try to play it! 🎵</span>
                <input value={songRequest} onChange={(e) => setSongRequest(e.target.value)}
                  placeholder="Song title and artist"
                  className="mt-1 w-full rounded border-gray-300 focus:border-[#00330a] focus:ring-[#00330a]" />
              </label>
            </>
          )}

          {error && <p className="text-red-700 text-sm" role="alert">{error}</p>}

          <button type="submit" disabled={isLoading}
            className="w-full rounded bg-[#00330a] px-4 py-3 text-white font-medium hover:bg-[#004d10] disabled:opacity-60 transition">
            {isLoading ? 'Sending…' : 'Send RSVP'}
          </button>
        </form>
      </div>

      {submitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="dialog" aria-modal="true">
          <div className="max-w-md w-full rounded-lg bg-[#FFFDF7] border border-[#D4AF37] p-8 text-center shadow-xl">
            <h2 className="font-serif text-2xl text-[#00330a] mb-3">Thank you!</h2>
            {submitted.attending ? (
              <>
                <p className="text-gray-700">
                  We look forward to celebrating with you. Watch your inbox for further
                  information — the date, time, and venue are on their way.
                </p>
                <p className="mt-4 text-gray-700">
                  Emme &amp; Connor are honeymooning in Ireland — taking you to
                  our Honeymoon Fund now&hellip;
                </p>
                <a
                  href="/registry"
                  className="inline-block mt-4 rounded bg-[#00330a] px-6 py-2 text-white text-sm hover:bg-[#004d10] transition"
                >
                  Go to the Honeymoon Fund now
                </a>
              </>
            ) : (
              <>
                <p className="text-gray-700">
                  Thank you for letting us know — we&apos;ll miss having you there.
                  We&apos;re sending love your way, and we hope to celebrate with you
                  another time soon. 💛
                </p>
                <p className="mt-4 text-sm text-gray-500">
                  Taking you back to the website in a moment…
                </p>
              </>
            )}
            <a href="/" className="inline-block mt-6 rounded bg-[#00330a] px-6 py-2 text-white text-sm hover:bg-[#004d10] transition" autoFocus>
              Back to the website
            </a>
          </div>
        </div>
      )}
    </main>
  )
}
