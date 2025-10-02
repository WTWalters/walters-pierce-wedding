'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Venue {
  id: string
  name: string
  venueType: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  zipCode: string
  phone: string
  website?: string
  googleMapsUrl?: string
  parkingInfo?: string
  directions?: string
  notes?: string
}

interface Event {
  id: string
  title: string
  description?: string
  startTime: string
  endTime?: string
  dressCode?: string
  venue: Venue
}

interface Hotel {
  id: string
  name: string
  address: string
  phone?: string
  website?: string
  bookingUrl?: string
  distanceFromVenue?: string
  priceRange?: string
  notes?: string
  isRecommended: boolean
}

export default function VenuePage() {
  const [venue, setVenue] = useState<Venue | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchVenueData()
  }, [])

  const fetchVenueData = async () => {
    try {
      const [venueResponse, eventsResponse, hotelsResponse] = await Promise.all([
        fetch('/api/venue'),
        fetch('/api/venue/events'),
        fetch('/api/venue/hotels')
      ])

      const [venueData, eventsData, hotelsData] = await Promise.all([
        venueResponse.json(),
        eventsResponse.json(),
        hotelsResponse.json()
      ])

      setVenue(venueData.venue)
      setEvents(eventsData.events || [])
      setHotels(hotelsData.hotels || [])
    } catch (error) {
      console.error('Failed to fetch venue data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatEventTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading venue information...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-amber-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-green-900 font-serif mb-2">
              Venue & Travel
            </h1>
            <p className="text-green-700 text-lg">
              Emme & Connor's Wedding
            </p>
            <div className="mt-4">
              <Link 
                href="/"
                className="text-green-600 hover:text-green-800 underline"
              >
                ← Back to Wedding Website
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Venue Information */}
        {venue && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-green-900 mb-6 flex items-center">
              🏛️ {venue.name}
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Address</h3>
                <div className="text-gray-700 space-y-1">
                  <p>{venue.addressLine1}</p>
                  {venue.addressLine2 && <p>{venue.addressLine2}</p>}
                  <p>{venue.city}, {venue.state} {venue.zipCode}</p>
                </div>
                
                <h3 className="font-semibold text-gray-900 mb-3 mt-6">Contact</h3>
                <div className="text-gray-700 space-y-1">
                  <p>📞 {venue.phone}</p>
                  {venue.website && (
                    <p>
                      🌐 <a 
                        href={venue.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-800 underline"
                      >
                        Visit Website
                      </a>
                    </p>
                  )}
                </div>
              </div>
              
              <div>
                {venue.notes && (
                  <>
                    <h3 className="font-semibold text-gray-900 mb-3">About the Venue</h3>
                    <p className="text-gray-700 mb-6">{venue.notes}</p>
                  </>
                )}
                
                {venue.parkingInfo && (
                  <>
                    <h3 className="font-semibold text-gray-900 mb-3">Parking</h3>
                    <p className="text-gray-700 mb-6">{venue.parkingInfo}</p>
                  </>
                )}
                
                <div className="space-y-3">
                  {venue.googleMapsUrl && (
                    <a
                      href={venue.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full bg-green-600 text-white text-center py-3 px-4 rounded-md hover:bg-green-700 transition-colors"
                    >
                      📍 View on Google Maps
                    </a>
                  )}
                </div>
              </div>
            </div>

            {venue.directions && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">Directions</h3>
                <p className="text-green-800">{venue.directions}</p>
              </div>
            )}
          </div>
        )}

        {/* Wedding Timeline */}
        {events.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-green-900 mb-6 flex items-center">
              ⏰ Wedding Day Timeline
            </h2>
            
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="border-l-4 border-green-600 pl-6 py-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{event.title}</h3>
                      {event.description && (
                        <p className="text-gray-600 mt-1">{event.description}</p>
                      )}
                      <div className="mt-2 text-sm text-gray-500">
                        <p>📅 {formatEventDate(event.startTime)}</p>
                        <p>🕐 {formatEventTime(event.startTime)}</p>
                        {event.dressCode && <p>👔 {event.dressCode}</p>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Accommodations */}
        {hotels.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-green-900 mb-6 flex items-center">
              🏨 Recommended Accommodations
            </h2>
            
            <div className="grid gap-6">
              {hotels
                .sort((a, b) => (b.isRecommended ? 1 : 0) - (a.isRecommended ? 1 : 0))
                .map((hotel) => (
                  <div 
                    key={hotel.id} 
                    className={`border-2 rounded-lg p-6 ${
                      hotel.isRecommended 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                          {hotel.name}
                          {hotel.isRecommended && (
                            <span className="ml-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                              Recommended
                            </span>
                          )}
                        </h3>
                        <p className="text-gray-600">{hotel.address}</p>
                      </div>
                      {hotel.priceRange && (
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Price Range</p>
                          <p className="font-semibold text-green-700">{hotel.priceRange}</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div>
                        {hotel.phone && <p className="text-sm text-gray-600">📞 {hotel.phone}</p>}
                        {hotel.distanceFromVenue && (
                          <p className="text-sm text-gray-600">🚗 {hotel.distanceFromVenue} from venue</p>
                        )}
                      </div>
                      <div>
                        {hotel.notes && <p className="text-sm text-gray-600">{hotel.notes}</p>}
                      </div>
                    </div>
                    
                    <div className="flex space-x-3">
                      {hotel.website && (
                        <a
                          href={hotel.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors text-sm"
                        >
                          Visit Website
                        </a>
                      )}
                      {hotel.bookingUrl && (
                        <a
                          href={hotel.bookingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-sm"
                        >
                          Book Now
                        </a>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Additional Information */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-green-900 mb-6">Additional Information</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Weather</h3>
              <p className="text-gray-700 mb-4">
                September in Colorado typically features mild temperatures with highs in the 70s°F and lows in the 40s°F. 
                We recommend bringing a light jacket for the evening.
              </p>
              
              <h3 className="font-semibold text-gray-900 mb-3">Altitude</h3>
              <p className="text-gray-700">
                Idaho Springs is at approximately 7,540 feet elevation. If you're not used to altitude, 
                we recommend arriving a day early to acclimate and staying hydrated.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Transportation</h3>
              <p className="text-gray-700 mb-4">
                The venue is about 45 minutes from Denver International Airport via I-70 West. 
                Rental cars are recommended for the most convenient travel.
              </p>
              
              <h3 className="font-semibold text-gray-900 mb-3">Local Attractions</h3>
              <p className="text-gray-700">
                Consider making a weekend of it! Idaho Springs offers historic charm, hot springs, 
                and beautiful mountain scenery. Georgetown and Silver Plume are nearby for additional exploration.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}