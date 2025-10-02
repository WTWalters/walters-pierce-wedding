require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function createWeddingPartyEnums() {
  console.log('🏗️ Creating wedding party enums...')
  
  try {
    // Create WeddingPartySide enum
    await prisma.$executeRaw`
      CREATE TYPE "WeddingPartySide" AS ENUM ('bride', 'groom');
    `
    console.log('✅ Created WeddingPartySide enum')
    
    // Create WeddingPartyRole enum
    await prisma.$executeRaw`
      CREATE TYPE "WeddingPartyRole" AS ENUM (
        'maid_of_honor', 
        'bridesmaid', 
        'best_man', 
        'groomsman', 
        'flower_girl', 
        'ring_bearer'
      );
    `
    console.log('✅ Created WeddingPartyRole enum')
    
    // Update the wedding_party table to use the enums
    await prisma.$executeRaw`
      ALTER TABLE wedding_party 
      ALTER COLUMN role TYPE "WeddingPartyRole" USING role::"WeddingPartyRole";
    `
    
    await prisma.$executeRaw`
      ALTER TABLE wedding_party 
      ALTER COLUMN side TYPE "WeddingPartySide" USING side::"WeddingPartySide";
    `
    
    console.log('✅ Updated table columns to use enums')
    console.log('🎉 Wedding party enums created successfully!')
    
  } catch (error) {
    console.error('❌ Error creating wedding party enums:', error.message)
  }
}

createWeddingPartyEnums()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })