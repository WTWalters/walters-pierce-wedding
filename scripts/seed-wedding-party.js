require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const weddingPartyData = [
  // Bride's Side
  {
    name: 'Sarah Mitchell',
    role: 'maid_of_honor',
    side: 'bride',
    bio: 'Emme\'s best friend since college and roommate for three years. Sarah is a graphic designer who loves hiking and always brings the best energy to any gathering.',
    relationship: 'Best Friend & College Roommate',
    photoUrl: '/wedding-party/sarah-mitchell.jpg',
    sortOrder: 1,
    isFeatured: true
  },
  {
    name: 'Jessica Walters',
    role: 'bridesmaid',
    side: 'bride',
    bio: 'Emme\'s younger sister and partner in crime since childhood. Jessica is a teacher who loves reading and traveling the world.',
    relationship: 'Sister',
    photoUrl: '/wedding-party/jessica-walters.jpg',
    sortOrder: 2,
    isFeatured: false
  },
  {
    name: 'Amanda Rodriguez',
    role: 'bridesmaid',
    side: 'bride',
    bio: 'Emme\'s high school best friend who introduced her to her love of photography. Amanda is a nurse who volunteers at animal shelters in her free time.',
    relationship: 'High School Best Friend',
    photoUrl: '/wedding-party/amanda-rodriguez.jpg',
    sortOrder: 3,
    isFeatured: false
  },
  {
    name: 'Emily Chen',
    role: 'bridesmaid',
    side: 'bride',
    bio: 'Emme\'s work colleague turned close friend. Emily is a software engineer who loves rock climbing and cooking elaborate meals.',
    relationship: 'Work Friend',
    photoUrl: '/wedding-party/emily-chen.jpg',
    sortOrder: 4,
    isFeatured: false
  },
  {
    name: 'Lily Thompson',
    role: 'flower_girl',
    side: 'bride',
    bio: 'Emme\'s adorable niece who loves unicorns, drawing, and asking endless questions about everything.',
    relationship: 'Niece',
    photoUrl: '/wedding-party/lily-thompson.jpg',
    sortOrder: 5,
    isFeatured: false
  },

  // Groom's Side
  {
    name: 'Marcus Johnson',
    role: 'best_man',
    side: 'groom',
    bio: 'Connor\'s best friend since high school and his adventure buddy. Marcus is an outdoor guide who has taken Connor on countless hiking and skiing trips.',
    relationship: 'Best Friend Since High School',
    photoUrl: '/wedding-party/marcus-johnson.jpg',
    sortOrder: 1,
    isFeatured: true
  },
  {
    name: 'Daniel Pierce',
    role: 'groomsman',
    side: 'groom',
    bio: 'Connor\'s older brother and role model. Daniel is a firefighter who taught Connor the importance of helping others.',
    relationship: 'Brother',
    photoUrl: '/wedding-party/daniel-pierce.jpg',
    sortOrder: 2,
    isFeatured: false
  },
  {
    name: 'Ryan Murphy',
    role: 'groomsman',
    side: 'groom',
    bio: 'Connor\'s college roommate and fraternity brother. Ryan is a financial advisor who still challenges Connor to video game tournaments.',
    relationship: 'College Roommate',
    photoUrl: '/wedding-party/ryan-murphy.jpg',
    sortOrder: 3,
    isFeatured: false
  },
  {
    name: 'Alex Thompson',
    role: 'groomsman',
    side: 'groom',
    bio: 'Connor\'s coworker and climbing partner. Alex is an engineer who shares Connor\'s passion for both technology and the outdoors.',
    relationship: 'Work Friend & Climbing Partner',
    photoUrl: '/wedding-party/alex-thompson.jpg',
    sortOrder: 4,
    isFeatured: false
  },
  {
    name: 'Noah Pierce',
    role: 'ring_bearer',
    side: 'groom',
    bio: 'Connor\'s nephew who loves dinosaurs, soccer, and being the center of attention at family gatherings.',
    relationship: 'Nephew',
    photoUrl: '/wedding-party/noah-pierce.jpg',
    sortOrder: 5,
    isFeatured: false
  }
]

async function seedWeddingParty() {
  console.log('🌱 Seeding wedding party data...')
  
  try {
    // Clear existing wedding party data
    await prisma.weddingParty.deleteMany({})
    console.log('🧹 Cleared existing wedding party data')
    
    // Create wedding party members
    for (const member of weddingPartyData) {
      await prisma.weddingParty.create({
        data: member
      })
      
      console.log(`✅ Created wedding party member: ${member.name} (${member.role})`)
    }
    
    console.log('🎉 Wedding party seeding completed!')
    console.log('\n👰 Bride\'s Side:')
    weddingPartyData
      .filter(m => m.side === 'bride')
      .forEach(m => console.log(`   ${m.name} - ${m.role.replace('_', ' ')}`))
    
    console.log('\n🤵 Groom\'s Side:')
    weddingPartyData
      .filter(m => m.side === 'groom')
      .forEach(m => console.log(`   ${m.name} - ${m.role.replace('_', ' ')}`))
    
  } catch (error) {
    console.error('❌ Error seeding wedding party:', error.message)
  }
}

seedWeddingParty()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })