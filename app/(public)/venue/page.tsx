import Link from 'next/link'

// The venue, directions, and travel details are deliberately not published.
// Invited guests receive them directly by email (see the gated RSVP flow).
export default function VenuePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50 py-20 px-6">
      <div className="max-w-2xl mx-auto text-center">
        <span className="text-6xl" role="img" aria-label="Mountains">
          ⛰️
        </span>
        <h1 className="font-serif text-4xl md:text-5xl font-light text-green-900 mt-8 mb-6">
          A Celebration in the Colorado Mountains
        </h1>
        <p className="text-lg text-gray-700 leading-relaxed mb-6">
          Emme &amp; Connor will be married in September 2026, surrounded by
          mountain air and the people they love most.
        </p>
        <p className="text-lg text-gray-700 leading-relaxed mb-6">
          To keep the celebration intimate, the venue, directions, and travel
          details are shared directly with invited guests. Everything you need
          to plan your trip will arrive with your invitation — watch your
          inbox.
        </p>
        <p className="text-sm text-gray-600 mb-12">
          One planning tip we can share now: the celebration will be at
          mountain elevation, so pack layers and drink plenty of water when you
          arrive in Colorado.
        </p>
        <Link
          href="/save-the-date"
          className="inline-block bg-green-900 text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-green-800 transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          Save the Date
        </Link>
      </div>
    </main>
  )
}
