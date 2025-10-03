'use client'

import { useState, useEffect } from 'react'
import Link from "next/link"
import { ChevronLeft, ChevronRight, Calendar, MapPin, Clock } from 'lucide-react'

// Engagement photos
const engagementPhotos = [
  {
    src: '/images/engagement/Choice 01.jpg',
    alt: 'Emme and Connor engagement photo 1',
  },
  {
    src: '/images/engagement/Choice 02.jpg',
    alt: 'Emme and Connor engagement photo 2',
  },
  {
    src: '/images/engagement/Choice 03.jpg',
    alt: 'Emme and Connor engagement photo 3',
  },
  {
    src: '/images/engagement/Choice 04.jpg',
    alt: 'Emme and Connor engagement photo 4',
  },
  {
    src: '/images/engagement/Choice 05.jpg',
    alt: 'Emme and Connor engagement photo 5',
  },
  {
    src: '/images/engagement/Choice 06.jpg',
    alt: 'Emme and Connor engagement photo 6',
  },
  {
    src: '/images/engagement/Choice 07.jpg',
    alt: 'Emme and Connor engagement photo 7',
  },
  {
    src: '/images/engagement/Choice 08.jpg',
    alt: 'Emme and Connor engagement photo 8',
  },
  {
    src: '/images/engagement/Choice 09.jpg',
    alt: 'Emme and Connor engagement photo 9',
  },
]

export default function Home() {
  const [currentPhoto, setCurrentPhoto] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  // Auto-advance carousel
  useEffect(() => {
    if (isAutoPlaying) {
      const interval = setInterval(() => {
        setCurrentPhoto(prev => (prev + 1) % engagementPhotos.length)
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [isAutoPlaying])

  const nextPhoto = () => {
    setCurrentPhoto(prev => (prev + 1) % engagementPhotos.length)
    setIsAutoPlaying(false)
  }

  const prevPhoto = () => {
    setCurrentPhoto(prev => prev === 0 ? engagementPhotos.length - 1 : prev - 1)
    setIsAutoPlaying(false)
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50">
      {/* Hero Section with Photo Carousel */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Carousel */}
        <div className="absolute inset-0 z-0">
          {engagementPhotos.map((photo, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentPhoto ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <img
                src={photo.src}
                alt={photo.alt}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-green-900/5 via-transparent to-amber-900/5" />
            </div>
          ))}
        </div>

        {/* Hero Content */}
        <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-6">
          <div className="mb-8">
            <div className="inline-block">
              <h1 className="text-7xl md:text-8xl lg:text-9xl font-light font-serif mb-4 tracking-wide">
                <span className="block text-4xl md:text-5xl lg:text-6xl mb-2 text-amber-200 font-normal" style={{ textShadow: '3px 3px 8px rgba(0,0,0,0.9), 1px 1px 4px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.6)' }}>
                  The Wedding of
                </span>
                <span className="block text-white font-light" style={{ textShadow: '4px 4px 12px rgba(0,0,0,0.9), 2px 2px 6px rgba(0,0,0,0.8), 0 0 25px rgba(0,0,0,0.7)' }}>
                  Emme & Connor
                </span>
              </h1>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 text-lg md:text-xl text-amber-100 mb-12" style={{ textShadow: '3px 3px 8px rgba(0,0,0,0.9), 1px 1px 4px rgba(0,0,0,0.8)' }}>
            <div className="flex items-center gap-2">
              <a
                href="data:text/calendar;charset=utf8,BEGIN:VCALENDAR%0AVERSION:2.0%0APRODID:-//Emme%20%26%20Connor//Wedding//EN%0ABEGIN:VEVENT%0ADTSTART:20260920T160000%0ADTEND:20260920T220000%0ASUMMARY:Emme%20%26%20Connor's%20Wedding%0ADESCRIPTION:Join%20us%20as%20we%20celebrate%20our%20special%20day%20in%20the%20beautiful%20Colorado%20mountains!%0ALOCATION:Idaho%20Springs%2C%20Colorado%0AUID:wedding-emme-connor-2026%0AEND:VEVENT%0AEND:VCALENDAR"
                download="Emme-Connor-Wedding.ics"
                className="cursor-pointer hover:scale-110 transition-transform duration-200"
                aria-label="Add wedding date to calendar"
              >
                <Calendar className="w-6 h-6" style={{ filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.8)) drop-shadow(0 0 8px rgba(0,0,0,0.6))' }} />
              </a>
              <span className="font-light">September 2026</span>
            </div>
            <div className="hidden md:block w-px h-6 bg-amber-200/50" />
            <div className="flex items-center gap-2">
              <a
                href="https://www.google.com/maps/place/Idaho+Springs,+CO"
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer hover:scale-110 transition-transform duration-200"
                aria-label="Open Idaho Springs, Colorado in Google Maps"
              >
                <MapPin className="w-6 h-6" style={{ filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.8)) drop-shadow(0 0 8px rgba(0,0,0,0.6))' }} />
              </a>
              <span className="font-light">Idaho Springs, Colorado</span>
            </div>
          </div>

          {/* Save the Date button in hero */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/save-the-date"
              className="bg-white text-green-900 px-8 py-4 rounded-full font-semibold text-lg hover:bg-amber-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              Save the Date
            </Link>
          </div>
        </div>

        {/* Carousel Controls */}
        <button
          onClick={prevPhoto}
          className="absolute left-6 top-1/2 transform -translate-y-1/2 z-20 bg-white/20 backdrop-blur-sm text-white p-3 rounded-full hover:bg-white/30 transition-all duration-200"
          aria-label="Previous photo"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={nextPhoto}
          className="absolute right-6 top-1/2 transform -translate-y-1/2 z-20 bg-white/20 backdrop-blur-sm text-white p-3 rounded-full hover:bg-white/30 transition-all duration-200"
          aria-label="Next photo"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Photo Indicators */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 flex gap-2">
          {engagementPhotos.map((_, index) => (
            <button
              key={index}
              onClick={() => {setCurrentPhoto(index); setIsAutoPlaying(false)}}
              className={`w-3 h-3 rounded-full transition-all duration-200 ${
                index === currentPhoto ? 'bg-white' : 'bg-white/40 hover:bg-white/70'
              }`}
              aria-label={`Go to photo ${index + 1}`}
            />
          ))}
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 z-20 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-white/70 rounded-full mt-2 animate-pulse" />
          </div>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="w-full py-20 bg-white">
        <div className="w-full max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-light font-serif text-green-900 mb-6">
              Our Love Story
            </h2>
            <div className="w-24 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent mx-auto mb-8" />
            <p className="text-lg md:text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed font-light" style={{ hyphens: 'none', wordBreak: 'normal' }}>
              Connor and Emme's story begins at the most romantic of places… a Kava bar in Longmont. 
              What started as a spy mission on Connor's date with Emme's friend turned into laughter, 
              friendship, and ultimately love at first sight (well, maybe second sight). 
              Join us as we celebrate the beginning of our forever in the breathtaking Colorado mountains.
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <div className="text-center space-y-8">
              <div className="prose prose-lg mx-auto text-gray-700 leading-relaxed">
                <p style={{ hyphens: 'none', wordBreak: 'normal' }}>
                  Their "official" first meeting was anything but romantic—Connor showed up at Emme's house 
                  to pick up her friend for a date. Emme and her partner-in-crime decided to tag along and spy. 
                  The undercover mission was a total flop, but over kava and laughter that night, sparks flew.
                </p>
                <p style={{ hyphens: 'none', wordBreak: 'normal' }}>
                  There was one small complication: Emme had a boyfriend. But just like Ross and Rachel, 
                  the friendship came first... and it took exactly one week for her to realize Connor 
                  wasn't just another friend—he was <em>The One</em>.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-12 mt-12 max-w-4xl mx-auto">
                <div className="text-center space-y-4 px-8" style={{ minWidth: '300px' }}>
                  <div className="w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center mx-auto mb-4">
                    <div className="text-2xl">💍</div>
                  </div>
                  <h4 className="text-xl font-serif text-green-900 whitespace-nowrap" style={{ hyphens: 'none', wordBreak: 'keep-all', whiteSpace: 'nowrap' }}>The Proposal</h4>
                  <div className="text-2xl font-light text-green-800 mb-2 whitespace-nowrap" style={{ whiteSpace: 'nowrap' }}>June 8, 2025</div>
                  <div className="px-4">
                    <p className="text-sm text-gray-600 leading-relaxed" style={{ hyphens: 'none', wordBreak: 'normal', minWidth: '250px' }}>
                      After 6 months of planning, Connor popped the question. Emme wore jeans to her own proposal!
                    </p>
                  </div>
                </div>

                <div className="text-center space-y-4 px-8" style={{ minWidth: '300px' }}>
                  <div className="w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center mx-auto mb-4">
                    <div className="text-2xl">⛰️</div>
                  </div>
                  <h4 className="text-xl font-serif text-green-900 whitespace-nowrap" style={{ hyphens: 'none', wordBreak: 'keep-all', whiteSpace: 'nowrap' }}>The Wedding</h4>
                  <div className="text-2xl font-light text-green-800 mb-2 whitespace-nowrap" style={{ whiteSpace: 'nowrap' }}>September 2026</div>
                  <div className="px-4 mb-4">
                    <p className="text-sm text-gray-600 whitespace-nowrap" style={{ hyphens: 'none', wordBreak: 'keep-all', whiteSpace: 'nowrap' }}>
                      Colorado Mountains
                    </p>
                  </div>
                  {/* RSVP button hidden for now - will use Save the Date instead
                  <Link
                    href="/rsvp"
                    className="inline-block bg-green-800 text-white px-6 py-2 rounded-full text-sm font-medium hover:bg-green-900 transition-colors shadow-md whitespace-nowrap"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    RSVP for Details
                  </Link>
                  */}
                  <Link
                    href="/save-the-date"
                    className="inline-block bg-green-800 text-white px-6 py-2 rounded-full text-sm font-medium hover:bg-green-900 transition-colors shadow-md whitespace-nowrap"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Save the Date
                  </Link>
                </div>
              </div>
            </div>

            {/* Detailed wedding information will be available to confirmed guests after RSVPing.
            <div className="mt-12 p-6 bg-white border border-gray-200 rounded-lg text-center">
              <p className="text-sm text-green-700 italic" style={{ hyphens: 'none', wordBreak: 'normal' }}>
                Detailed wedding information will be available to confirmed guests after RSVPing.
              </p>
            </div>
            */}
          </div>
        </div>
      </section>

      {/* Quick Links Section */}
      <section className="w-full py-20 bg-gradient-to-br from-green-50 to-amber-50">
        <div className="w-full max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-light font-serif text-green-900 mb-6" style={{ hyphens: 'none', wordBreak: 'keep-all' }}>
              Join Our Celebration
            </h2>
            <div className="w-24 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent mx-auto" />
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* RSVP card hidden for now - replaced with Save the Date
            <Link
              href="/rsvp"
              className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 text-center"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Calendar className="w-8 h-8 text-green-700" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3" style={{ hyphens: 'none', wordBreak: 'keep-all' }}>RSVP</h3>
              <p className="text-gray-600 leading-relaxed" style={{ hyphens: 'none', wordBreak: 'normal' }}>
                Please let us know if you can celebrate with us. We can&apos;t wait to see you there!
              </p>
            </Link>
            */}
            
            <Link
              href="/save-the-date"
              className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 text-center"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Calendar className="w-8 h-8 text-green-700" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3" style={{ hyphens: 'none', wordBreak: 'keep-all' }}>Save the Date</h3>
              <p className="text-gray-600 leading-relaxed" style={{ hyphens: 'none', wordBreak: 'normal' }}>
                Share your information with us so we can send you a formal invitation.
              </p>
            </Link>

            <Link
              href="/wedding-party"
              className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 text-center"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-rose-100 to-rose-200 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <div className="text-2xl">👰🤵</div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3" style={{ hyphens: 'none', wordBreak: 'keep-all' }}>Wedding Party</h3>
              <p className="text-gray-600 leading-relaxed" style={{ hyphens: 'none', wordBreak: 'normal' }}>
                Meet the special people who will be standing with us on our big day.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* Important Information */}
      <section className="w-full py-20 bg-white">
        <div className="w-full max-w-4xl mx-auto px-6">
          <div className="bg-gradient-to-br from-green-50 to-amber-50 rounded-3xl p-8 md:p-12 shadow-xl border border-green-100">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-light font-serif text-green-900 mb-4">
                We Can&apos;t Wait to Celebrate
              </h2>
              <div className="w-16 h-px bg-gradient-to-r from-transparent via-green-400 to-transparent mx-auto" />
            </div>
            
            <div className="text-center space-y-8">
              <p className="text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed px-4" style={{ hyphens: 'none', wordBreak: 'normal', whiteSpace: 'normal' }}>
                Join us for an intimate celebration surrounded by the beauty of the Colorado mountains. 
                Your presence is the greatest gift we could ask for.
              </p>
              
              <div className="max-w-4xl mx-auto px-8">
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-green-100" style={{ minWidth: '300px' }}>
                  <div className="text-4xl mb-4">💌</div>
                  <h3 className="text-xl font-semibold text-green-900 mb-3" style={{ hyphens: 'none', wordBreak: 'keep-all', whiteSpace: 'nowrap', textAlign: 'center' }}>
                    Save the Date
                  </h3>
                  <p className="text-gray-700 leading-relaxed text-center" style={{ hyphens: 'none', wordBreak: 'normal', whiteSpace: 'normal', minWidth: '250px' }}>
                    Please share your information with us so we can send you a formal invitation with
                    all the details for our special day.
                  </p>
                  <div className="mt-6">
                    <Link
                      href="/save-the-date"
                      className="inline-block bg-green-700 text-white px-8 py-3 rounded-full font-semibold hover:bg-green-800 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                    >
                      Save the Date
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-center mt-8 p-6 bg-white/70 rounded-2xl">
              <p className="text-green-800 italic">
                &ldquo;Being deeply loved by someone gives you strength, while loving someone deeply gives you courage.&rdquo;
              </p>
              <p className="text-green-600 text-sm mt-2">— Lao Tzu</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full bg-green-900 text-white py-12">
        <div className="w-full max-w-4xl mx-auto px-6 text-center">
          <h3 className="text-2xl font-light font-serif mb-4">
            Emme & Connor
          </h3>
          <p className="text-green-200 mb-6">
            September 2026 • Colorado Mountains
          </p>
          <div className="flex justify-center gap-6 text-sm text-green-300">
            {/* <Link href="/rsvp" className="hover:text-white transition-colors">RSVP</Link> */}
            <Link href="/save-the-date" className="hover:text-white transition-colors">Save the Date</Link>
            <Link href="/wedding-party" className="hover:text-white transition-colors">Wedding Party</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}