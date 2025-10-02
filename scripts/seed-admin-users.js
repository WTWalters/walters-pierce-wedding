require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const adminUsers = [
  { 
    email: 'whitney@walters-pierce-wedding.com', 
    name: 'Whitney Thomas Walters', 
    role: 'admin',
    password: 'admin123' // Change this in production
  },
  { 
    email: 'nicolle@walters-pierce-wedding.com', 
    name: 'Laurie Nicolle Walters', 
    role: 'admin',
    password: 'admin123'
  },
  { 
    email: 'emme@walters-pierce-wedding.com', 
    name: 'Murielle Aisling Walters', 
    role: 'admin',
    password: 'admin123'
  },
  { 
    email: 'ceejay@walters-pierce-wedding.com', 
    name: 'Connor Joseph Pierce', 
    role: 'admin',
    password: 'admin123'
  },
  { 
    email: 'callie@walters-pierce-wedding.com', 
    name: 'Callie [LastName]', 
    role: 'admin',
    password: 'admin123'
  }
]

async function seedAdminUsers() {
  console.log('🌱 Seeding admin users...')
  
  for (const user of adminUsers) {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email }
      })
      
      if (existingUser) {
        console.log(`⚠️  User ${user.email} already exists, skipping...`)
        continue
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(user.password, 12)
      
      // Create user
      await prisma.user.create({
        data: {
          email: user.email,
          passwordHash: passwordHash,
          role: user.role
        }
      })
      
      console.log(`✅ Created admin user: ${user.email}`)
      
    } catch (error) {
      console.error(`❌ Error creating user ${user.email}:`, error.message)
    }
  }
  
  console.log('🎉 Admin user seeding completed!')
}

seedAdminUsers()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })