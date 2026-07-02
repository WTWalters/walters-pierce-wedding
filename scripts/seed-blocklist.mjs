// Seeds/updates the RSVP blocklist Setting row. Idempotent.
// Usage: node scripts/seed-blocklist.mjs
import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

config({ path: '.env.local' })
const prisma = new PrismaClient()

const BLOCKLIST = [
  'marci harris',
  'marciann harris',
  'marci ann harris',
  'montana harris',
  'tom walters',
  'thomas walters',
]

const row = await prisma.setting.upsert({
  where: { key: 'rsvp_blocklist' },
  create: {
    key: 'rsvp_blocklist',
    value: JSON.stringify(BLOCKLIST),
    valueType: 'json',
    description: 'Normalized full names that cannot RSVP (managed discreetly)',
  },
  update: { value: JSON.stringify(BLOCKLIST) },
})
console.log('Blocklist seeded:', JSON.parse(row.value).length, 'entries')
await prisma.$disconnect()
