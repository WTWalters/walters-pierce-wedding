require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const testGuests = [
  {
    email: 'john.smith@example.com',
    firstName: 'John',
    lastName: 'Smith',
    phone: '555-0101',
    invitationCode: 'JS2026',
    addressLine1: '123 Main St',
    city: 'Denver',
    state: 'CO',
    zipCode: '80201'
  },
  {
    email: 'jane.doe@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '555-0102',
    invitationCode: 'JD2026',
    addressLine1: '456 Oak Ave',
    city: 'Boulder',
    state: 'CO',
    zipCode: '80301'
  },
  {
    email: 'bob.wilson@example.com',
    firstName: 'Bob',
    lastName: 'Wilson',
    phone: '555-0103',
    invitationCode: 'BW2026',
    addressLine1: '789 Pine Rd',
    city: 'Colorado Springs',
    state: 'CO',
    zipCode: '80901'
  },
  {
    email: 'alice.johnson@example.com',
    firstName: 'Alice',
    lastName: 'Johnson',
    phone: '555-0104',
    invitationCode: 'AJ2026',
    addressLine1: '321 Elm St',
    city: 'Fort Collins',
    state: 'CO',
    zipCode: '80521'
  },
  {
    email: 'mike.brown@example.com',
    firstName: 'Mike',
    lastName: 'Brown',
    phone: '555-0105',
    invitationCode: 'MB2026',
    addressLine1: '654 Maple Dr',
    city: 'Aurora',
    state: 'CO',
    zipCode: '80012'
  }
]

async function seedTestGuests() {
  console.log('🌱 Seeding test guests for RSVP testing...')
  
  for (const guest of testGuests) {
    try {
      // Check if guest already exists
      const existingGuest = await prisma.guest.findUnique({
        where: { email: guest.email }
      })
      
      if (existingGuest) {
        console.log(`⚠️  Guest ${guest.email} already exists, skipping...`)
        continue
      }
      
      // Create guest
      await prisma.guest.create({
        data: guest
      })
      
      console.log(`✅ Created test guest: ${guest.firstName} ${guest.lastName} (${guest.invitationCode})`)
      
    } catch (error) {
      console.error(`❌ Error creating guest ${guest.email}:`, error.message)
    }
  }
  
  console.log('🎉 Test guest seeding completed!')
  console.log('\n📝 Test invitation codes to use:')
  testGuests.forEach(guest => {
    console.log(`   ${guest.invitationCode} - ${guest.firstName} ${guest.lastName}`)
  })
}

seedTestGuests()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })