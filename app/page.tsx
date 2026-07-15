'use client'

import { useState, useEffect } from 'react'
import Link from "next/link"
import { ChevronLeft, ChevronRight, Calendar, MapPin, Clock } from 'lucide-react'

// Engagement photos — displayed in filename order.
// fit: 'contain' shows the FULL photo (letterboxed over a blurred backdrop)
// instead of cropping to fill — used where the wide composition matters.
const engagementPhotos: { src: string; alt: string; fit?: 'contain' }[] = [
  { src: '/images/engagement/DSC01845-100.jpg', alt: 'Emme and Connor engagement photo 1' },
  { src: '/images/engagement/DSC01845-103.jpg', alt: 'Emme and Connor engagement photo 4' },
  { src: '/images/engagement/DSC01845-104.jpg', alt: 'Emme and Connor engagement photo 5' },
  { src: '/images/engagement/DSC01845-105.jpg', alt: 'Emme and Connor engagement photo 6' },
  { src: '/images/engagement/DSC01845-106.jpg', alt: 'Emme and Connor engagement photo 7', fit: 'contain' },
  { src: '/images/engagement/DSC01845-107.jpg', alt: 'Emme and Connor engagement photo 8' },
  { src: '/images/engagement/DSC01845-108A.jpg', alt: 'Emme and Connor engagement photo 9' },
  { src: '/images/engagement/DSC01845-109.jpg', alt: 'Emme and Connor engagement photo 10', fit: 'contain' },
  { src: '/images/engagement/DSC01767-100.jpg', alt: 'Emme and Connor engagement — seated with the ring', fit: 'contain' },
  { src: '/images/engagement/DSC01767-101.jpg', alt: 'Emme and Connor engagement — on the rocks at sunset', fit: 'contain' },
  { src: '/images/engagement/DSC01767-103.jpg', alt: 'Emme and Connor engagement — by the stone wall', fit: 'contain' },
  { src: '/images/engagement/DSC01767-106.jpg', alt: 'Emme and Connor engagement — walking the trail', fit: 'contain' },
  { src: '/images/engagement/DSC01767-108.jpg', alt: 'Emme and Connor engagement — a twirl on the path', fit: 'contain' },
  { src: '/images/engagement/DSC01767-109.jpg', alt: 'Emme and Connor engagement — mountain overlook portrait', fit: 'contain' },
  { src: '/images/engagement/DSC01767-111.jpg', alt: 'Emme and Connor engagement — the mountain vista', fit: 'contain' },
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
      <section className="relative h-[70vh] flex items-center justify-center overflow-hidden">
        {/* Background Carousel */}
        <div className="absolute inset-0 z-0">
          {engagementPhotos.map((photo, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentPhoto ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {photo.fit === 'contain' ? (
                <>
                  {/* blurred fill behind the letterboxed full photo */}
                  <img
                    src={photo.src}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                    style={{ filter: 'blur(28px) brightness(0.7)', transform: 'scale(1.1)' }}
                    loading={index === 0 ? 'eager' : 'lazy'}
                  />
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    className="relative w-full h-full object-contain object-center"
                    loading={index === 0 ? 'eager' : 'lazy'}
                  />
                </>
              ) : (
                <img
                  src={photo.src}
                  alt={photo.alt}
                  className="w-full h-full object-cover object-center"
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-br from-green-900/5 via-transparent to-amber-900/5" />
            </div>
          ))}
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

      </section>

      {/* Names + RSVP call-to-action, directly beneath the featured carousel */}
      <section className="w-full text-center px-6 py-14" style={{ background: '#faf6ee' }}>
        <p className="text-lg md:text-xl font-serif tracking-widest mb-2" style={{ color: '#9a7b1f' }}>
          The Wedding of
        </p>
        <h1 className="text-5xl md:text-6xl font-light font-serif text-green-900 mb-5">
          Emme &amp; Connor
        </h1>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-green-800 mb-9 text-lg">
          <span className="flex items-center gap-2">
            <Calendar className="w-5 h-5" /> September 2026
          </span>
          <span className="hidden sm:block w-px h-5 bg-amber-300" />
          <a
            href="https://www.google.com/maps/place/Rocky+Mountains,+Colorado"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:text-green-900 transition-colors"
            aria-label="Open the Colorado Mountains in Google Maps"
          >
            <MapPin className="w-5 h-5" /> Colorado Mountains
          </a>
        </div>
        <Link
          href="/rsvp"
          className="inline-block font-serif transition-opacity hover:opacity-90"
          style={{ background: '#D4AF37', color: '#00330a', fontSize: '20px', letterSpacing: '2px', fontWeight: 500, padding: '16px 64px', borderRadius: '999px' }}
        >
          RSVP
        </Link>
      </section>

      {/* Our Story Section */}
      <section className="w-full py-20 bg-white">
        <div className="w-full max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-light font-serif text-green-900 mb-6">
              Our Love Story
            </h2>
            <div className="w-24 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent mx-auto mb-8" />
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="text-center space-y-8">
              <div className="prose prose-lg mx-auto text-gray-700 leading-relaxed space-y-6">
                <p style={{ hyphens: 'none', wordBreak: 'normal' }}>
                  Connor and Emme's story begins at the most romantic of places… a Kava bar in Longmont. Their "official" first meeting, however, was anything but romantic. Connor showed up at Emme's house—not for her—but to pick up her friend for a date. Naturally, Emme and another partner-in-crime decided the only logical thing to do was tag along and spy on said date.
                </p>
                <p style={{ hyphens: 'none', wordBreak: 'normal' }}>
                  The undercover mission? A total flop. Subtlety was not their strong suit. After the date, everyone regrouped at the Kava bar, where Connor and Emme laughed over how terrible they were at being sneaky. And don't worry—her friend wasn't upset about the whole "stolen date" thing; she knew it wasn't exactly a Wesley-and-Buttercup type of fairytale in the making. Somewhere between the laughter, the kava, and a little harmless chaos… sparks flew.
                </p>
                <p style={{ hyphens: 'none', wordBreak: 'normal' }}>
                  There was only one small complication: Emme already had a boyfriend. But just like a true Ross-and-Rachel storyline, the friendship with Connor came first… and it didn't take long (about a week, to be exact) for her to realize he wasn't just another friend—he was The One. Boyfriend: dumped. Connor: upgraded to leading man.
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
                      Fast forward 2 and a half years later, and on June 8th, 2025, Connor popped the question! After six months of planning, scheming, and trying not to give away the surprise, the date was picked, the photoshoot was scheduled, and Connor's nerves were sky-high.
                    </p>
                    <p className="text-sm text-gray-600 leading-relaxed mt-2" style={{ hyphens: 'none', wordBreak: 'normal', minWidth: '250px' }}>
                      Emme woke up that morning telling herself, "He's not going to ask, don't get your hopes up!" Meanwhile, Connor was just trying to stay calm—and not comment on Emme showing up to her own proposal in jeans. The photos from that day say it all: Emme completely oblivious, Connor doing his best to play it cool while his heart was doing cartwheels.
                    </p>
                    <p className="text-sm text-gray-600 leading-relaxed mt-2" style={{ hyphens: 'none', wordBreak: 'normal', minWidth: '250px' }}>
                      Then it happened—Connor asked, Emme said yes (of course!), and the rest is history in the making. Now, they couldn't be more excited to celebrate their wedding with friends and family!
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
          
          <div className="grid gap-8 md:grid-cols-2 max-w-3xl mx-auto">
            <Link
              href="/wedding-party"
              className="group"
              // Plain inline styles on purpose: Tailwind's shadow/transform utilities
              // mis-paint this card's background on mobile WebKit/embedded renderers
              // (white fragments at the left edge). Verified clean in this form.
              style={{
                display: 'block',
                background: '#ffffff',
                borderRadius: '16px',
                padding: '32px',
                textAlign: 'center',
                border: '1px solid rgba(212,175,55,0.25)',
              }}
            >
              <div className="w-16 h-16 bg-gradient-to-br from-rose-100 to-rose-200 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <div className="text-2xl">👰🤵</div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3" style={{ hyphens: 'none', wordBreak: 'keep-all' }}>Wedding Party</h3>
              <p className="text-gray-600 leading-relaxed" style={{ hyphens: 'none', wordBreak: 'normal' }}>
                Meet the special people who will be standing with us on our big day.
              </p>
            </Link>
            <Link
              href="/registry"
              className="group"
              // Same inline-style rationale as the Wedding Party card above.
              style={{
                display: 'block',
                background: '#ffffff',
                borderRadius: '16px',
                padding: '32px',
                textAlign: 'center',
                border: '1px solid rgba(212,175,55,0.25)',
              }}
            >
              <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-amber-200 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <div className="text-2xl">🎁</div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3" style={{ hyphens: 'none', wordBreak: 'keep-all' }}>Honeymoon Fund</h3>
              <p className="text-gray-600 leading-relaxed" style={{ hyphens: 'none', wordBreak: 'normal' }}>
                Help send Emme &amp; Connor to Ireland with a gift toward the honeymoon.
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
                Your love, laughter, and company mean the world to us.
              </p>
              
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
            <Link href="/wedding-party" className="hover:text-white transition-colors">Wedding Party</Link>
            <Link href="/registry" className="hover:text-white transition-colors">Honeymoon Fund</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}