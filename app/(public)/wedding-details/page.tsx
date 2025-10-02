'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Calendar, MapPin, Clock, Users, Music, Camera, Gift, Car } from 'lucide-react'

interface Guest {
  id: string
  firstName: string
  lastName: string
  email: string
  invitationCode?: string
  attending?: boolean
  rsvpReceivedAt?: string
  plusOnes?: Array<{
    firstName: string
    lastName: string
  }>
}

export default function WeddingDetailsPage() {
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [guest, setGuest] = useState<Guest | null>(null)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    checkAccess()
  }, [])

  const checkAccess = async () => {
    try {
      // Check if user has valid RSVP session
      const response = await fetch('/api/wedding-details/access-check')
      const data = await response.json()

      if (response.ok && data.authorized && data.guest) {
        setIsAuthorized(true)
        setGuest(data.guest)
      } else {
        setError(data.message || 'Access denied')
      }
    } catch (error) {
      setError('Unable to verify access')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying your access...</p>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="mb-8">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-10 h-10 text-amber-700" />
            </div>
            <h1 className="text-3xl font-serif text-green-900 mb-4">
              Access Required
            </h1>
            <p className="text-gray-700 mb-6">
              This page is exclusively for our confirmed wedding guests. 
              Please RSVP "Yes" with your invitation code to access wedding details.
            </p>
            {error && (
              <p className="text-red-600 text-sm mb-4">{error}</p>
            )}
          </div>
          
          <div className="space-y-3">
            <Link
              href="/rsvp"
              className="block bg-green-900 text-white px-8 py-3 rounded-full font-semibold hover:bg-green-800 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              RSVP Now
            </Link>
            <Link
              href="/"
              className="block text-green-700 hover:text-green-900 transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-serif text-green-900 mb-1">
                Wedding Details
              </h1>
              <p className="text-green-700">
                Welcome, {guest?.firstName}! Here's everything you need to know.
              </p>
            </div>
            <Link
              href="/"
              className="text-green-700 hover:text-green-900 transition-colors font-medium"
            >
              ← Home
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        
        {/* Timeline */}
        <section className="bg-white rounded-2xl p-8 shadow-lg">
          <h2 className="text-2xl font-serif text-green-900 mb-8 text-center">
            Wedding Day Timeline
          </h2>
          
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-green-50 rounded-xl">
              <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6 text-green-700" />
              </div>
              <div>
                <h3 className="font-semibold text-green-900">1:00 PM - Guest Arrival</h3>
                <p className="text-gray-600">Please arrive by 1:00 PM for seating and pre-ceremony refreshments</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-xl">
              <div className="w-12 h-12 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <h3 className="font-semibold text-green-900">2:00 PM - Ceremony</h3>
                <p className="text-gray-600">Outdoor ceremony with mountain backdrop (approx. 30 minutes)</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-4 bg-rose-50 rounded-xl">
              <div className="w-12 h-12 bg-rose-200 rounded-full flex items-center justify-center flex-shrink-0">
                <Camera className="w-6 h-6 text-rose-700" />
              </div>
              <div>
                <h3 className="font-semibold text-green-900">2:30 PM - Photos & Cocktail Hour</h3>
                <p className="text-gray-600">Light refreshments while we take family and wedding party photos</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-xl">
              <div className="w-12 h-12 bg-purple-200 rounded-full flex items-center justify-center flex-shrink-0">
                <Gift className="w-6 h-6 text-purple-700" />
              </div>
              <div>
                <h3 className="font-semibold text-green-900">4:00 PM - Reception Begins</h3>
                <p className="text-gray-600">Dinner, toasts, and celebration</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl">
              <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0">
                <Music className="w-6 h-6 text-blue-700" />
              </div>
              <div>
                <h3 className="font-semibold text-green-900">6:00 PM - Dancing</h3>
                <p className="text-gray-600">First dance followed by dancing until 10:00 PM</p>
              </div>
            </div>
          </div>
        </section>

        {/* Location Details */}
        <section className="bg-white rounded-2xl p-8 shadow-lg">
          <h2 className="text-2xl font-serif text-green-900 mb-6 text-center">
            Venue Information
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-green-700 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900">Address</h3>
                  <p className="text-gray-600">
                    Blackstone Rivers Ranch<br />
                    123 Mountain View Drive<br />
                    Colorado Springs, CO 80919
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Car className="w-5 h-5 text-green-700 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900">Parking</h3>
                  <p className="text-gray-600">
                    Free on-site parking available. Follow signs to guest parking area.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-green-700 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900">Weather Backup</h3>
                  <p className="text-gray-600">
                    Indoor ceremony space available if weather doesn't cooperate.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-green-700 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900">Accessibility</h3>
                  <p className="text-gray-600">
                    Venue is wheelchair accessible with paved pathways.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-green-50 rounded-xl">
            <h3 className="font-semibold text-green-900 mb-2">Getting There</h3>
            <p className="text-gray-700 text-sm">
              The venue is about 45 minutes from downtown Colorado Springs. 
              We recommend arriving 15 minutes early to find parking and get seated.
            </p>
          </div>
        </section>

        {/* Important Notes */}
        <section className="bg-white rounded-2xl p-8 shadow-lg">
          <h2 className="text-2xl font-serif text-green-900 mb-6 text-center">
            Important Information
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-green-900 mb-2">Dress Code</h3>
                <p className="text-gray-700 mb-2">Formal/Cocktail Attire</p>
                <p className="text-sm text-gray-600">
                  Think garden party elegant! Ladies: sundresses, cocktail dresses, dressy separates. 
                  Gentlemen: suit and tie or sport coat with dress pants.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold text-green-900 mb-2">Weather</h3>
                <p className="text-sm text-gray-600">
                  September mountain weather can be unpredictable. Bring a light jacket or wrap 
                  for the evening - temperatures may drop to the 50s after sunset.
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-green-900 mb-2">Photography</h3>
                <p className="text-sm text-gray-600">
                  We'll have a professional photographer capturing our special moments. 
                  Feel free to take photos, but please be mindful during the ceremony.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold text-green-900 mb-2">Gifts</h3>
                <p className="text-sm text-gray-600">
                  Your presence is the only present we need! If you'd like to honor us with a gift, 
                  we have a registry at [Registry Info].
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="bg-gradient-to-r from-green-50 to-amber-50 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-serif text-green-900 mb-4">
            Questions?
          </h2>
          <p className="text-gray-700 mb-4">
            If you have any questions about the wedding day, please don't hesitate to reach out!
          </p>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Bride: Emme - <a href="mailto:emme@example.com" className="text-green-700 hover:text-green-900">emme@example.com</a></p>
            <p>Groom: Connor - <a href="mailto:connor@example.com" className="text-green-700 hover:text-green-900">connor@example.com</a></p>
          </div>
        </section>

        {/* Your RSVP Info */}
        {guest && (
          <section className="bg-white rounded-2xl p-8 shadow-lg border-l-4 border-green-500">
            <h2 className="text-2xl font-serif text-green-900 mb-4">
              Your RSVP Details
            </h2>
            <div className="space-y-2 text-gray-700">
              <p><strong>Name:</strong> {guest.firstName} {guest.lastName}</p>
              {guest.plusOnes && guest.plusOnes.length > 0 && (
                <div>
                  <strong>Plus Ones:</strong>
                  <ul className="ml-4 mt-1">
                    {guest.plusOnes.map((plusOne, index) => (
                      <li key={index}>• {plusOne.firstName} {plusOne.lastName}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p><strong>RSVP Received:</strong> {guest.rsvpReceivedAt ? new Date(guest.rsvpReceivedAt).toLocaleDateString() : 'N/A'}</p>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <Link
                href="/rsvp"
                className="text-green-700 hover:text-green-900 text-sm font-medium transition-colors"
              >
                Need to update your RSVP? Click here →
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}