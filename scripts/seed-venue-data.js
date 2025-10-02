require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const venueData = {
  name: 'Blackstone Rivers Ranch',
  venueType: 'both', // ceremony and reception
  addressLine1: '3673 Chicago Creek Road',
  city: 'Idaho Springs',
  state: 'CO',
  zipCode: '80452',
  phone: '303-567-2339',
  website: 'https://www.blackstoneriversranch.com/',
  googleMapsUrl: 'https://maps.google.com/?q=3673+Chicago+Creek+Road,+Idaho+Springs,+CO+80452',
  latitude: 39.7392, // Approximate coordinates for Idaho Springs area
  longitude: -105.5136,
  parkingInfo: 'On-site parking available for all guests',
  directions: 'Located in the beautiful Colorado mountains, approximately 45 minutes west of Denver via I-70. Take Exit 241B for Idaho Springs/Chicago Creek Road.',
  notes: 'Stunning mountain venue perfect for both ceremony and reception. Indoor and outdoor spaces available.'
}

const hotelData = [
  {
    name: 'Hampton Inn & Suites Denver West/Federal Center',
    address: '7 S Federal Blvd, Denver, CO 80219',
    phone: '303-922-2500',
    website: 'https://www.hilton.com/en/hotels/denfhx-hampton-suites-denver-west-federal-center/',
    bookingUrl: 'https://www.hilton.com/en/hotels/denfhx-hampton-suites-denver-west-federal-center/',
    distanceFromVenue: '35 minutes',
    priceRange: '$120-160/night',
    notes: 'Modern hotel with complimentary breakfast and fitness center',
    isRecommended: true
  },
  {
    name: 'Hotel Colorado',
    address: '526 Pine St, Glenwood Springs, CO 81601',
    phone: '970-945-6511',
    website: 'https://www.hotelcolorado.com/',
    bookingUrl: 'https://www.hotelcolorado.com/',
    distanceFromVenue: '2 hours',
    priceRange: '$180-250/night',
    notes: 'Historic luxury hotel for guests wanting to make a weekend of it',
    isRecommended: false
  },
  {
    name: 'Quality Inn & Suites Wheat Ridge - Denver West',
    address: '7840 W 49th Ave, Wheat Ridge, CO 80033',
    phone: '303-423-4000',
    website: 'https://www.choicehotels.com/',
    bookingUrl: 'https://www.choicehotels.com/',
    distanceFromVenue: '40 minutes',
    priceRange: '$80-120/night',
    notes: 'Budget-friendly option with easy highway access',
    isRecommended: true
  }
]

async function seedVenueData() {
  console.log('🌱 Seeding venue and hotel data...')
  
  try {
    // Check if venue already exists
    const existingVenue = await prisma.venue.findFirst({
      where: { name: venueData.name }
    })
    
    let venue
    if (existingVenue) {
      console.log(`⚠️  Venue ${venueData.name} already exists, updating...`)
      venue = await prisma.venue.update({
        where: { id: existingVenue.id },
        data: venueData
      })
    } else {
      venue = await prisma.venue.create({
        data: venueData
      })
      console.log(`✅ Created venue: ${venueData.name}`)
    }
    
    // Create wedding events
    const weddingDate = new Date('2026-09-15T14:00:00') // Placeholder date
    
    const ceremonyEvent = {
      title: 'Wedding Ceremony',
      description: 'The ceremony where Emme and Connor will exchange vows',
      startTime: weddingDate,
      endTime: new Date(weddingDate.getTime() + 60 * 60 * 1000), // 1 hour later
      venueId: venue.id,
      dressCode: 'Formal/Cocktail Attire',
      isPublic: true
    }
    
    const receptionEvent = {
      title: 'Wedding Reception',
      description: 'Celebration with dinner, dancing, and festivities',
      startTime: new Date(weddingDate.getTime() + 90 * 60 * 1000), // 1.5 hours after ceremony
      endTime: new Date(weddingDate.getTime() + 7 * 60 * 60 * 1000), // 7 hours after ceremony
      venueId: venue.id,
      dressCode: 'Formal/Cocktail Attire',
      isPublic: true
    }
    
    // Check if events exist
    const existingCeremony = await prisma.event.findFirst({
      where: { title: 'Wedding Ceremony' }
    })
    
    if (!existingCeremony) {
      await prisma.event.create({ data: ceremonyEvent })
      await prisma.event.create({ data: receptionEvent })
      console.log('✅ Created wedding events')
    } else {
      console.log('⚠️  Wedding events already exist, skipping...')
    }
    
    // Create hotels
    for (const hotel of hotelData) {
      const existingHotel = await prisma.hotel.findFirst({
        where: { name: hotel.name }
      })
      
      if (existingHotel) {
        console.log(`⚠️  Hotel ${hotel.name} already exists, skipping...`)
        continue
      }
      
      await prisma.hotel.create({
        data: hotel
      })
      
      console.log(`✅ Created hotel: ${hotel.name}`)
    }
    
    console.log('🎉 Venue and hotel data seeding completed!')
    
  } catch (error) {
    console.error('❌ Error seeding venue data:', error.message)
  }
}

seedVenueData()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })