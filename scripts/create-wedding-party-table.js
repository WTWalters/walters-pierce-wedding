require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function createWeddingPartyTable() {
  console.log('🏗️ Creating wedding_party table...')
  
  try {
    // Ensure UUID extension exists
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
    
    // Create the wedding_party table with raw SQL
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS wedding_party (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        side VARCHAR(20) NOT NULL,
        bio TEXT,
        relationship VARCHAR(255),
        photo_url VARCHAR(500),
        sort_order INTEGER DEFAULT 0,
        is_featured BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `
    
    console.log('✅ Created wedding_party table')
    
    // Create indexes
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_wedding_party_side ON wedding_party(side);
    `
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_wedding_party_role ON wedding_party(role);
    `
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_wedding_party_sort ON wedding_party(sort_order);
    `
    
    console.log('✅ Created indexes')
    
    // Add trigger for updated_at (only if it doesn't exist)
    try {
      await prisma.$executeRaw`
        CREATE TRIGGER update_wedding_party_updated_at 
        BEFORE UPDATE ON wedding_party
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `
    } catch (triggerError) {
      console.log('⚠️ Trigger might already exist, continuing...')
    }
    
    console.log('✅ Created trigger')
    console.log('🎉 Wedding party table setup completed!')
    
  } catch (error) {
    console.error('❌ Error creating wedding party table:', error.message)
  }
}

createWeddingPartyTable()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })