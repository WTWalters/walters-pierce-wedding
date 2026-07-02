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

const existing = await prisma.setting.findUnique({ where: { key: 'rsvp_blocklist' } })
let merged = BLOCKLIST
if (existing?.value) {
  try {
    const current = JSON.parse(existing.value)
    if (Array.isArray(current)) {
      merged = [...new Set([...current.map(String), ...BLOCKLIST])]
    }
  } catch {
    console.warn('Existing rsvp_blocklist value was invalid JSON; replacing with seed list')
  }
}
const row = await prisma.setting.upsert({
  where: { key: 'rsvp_blocklist' },
  create: {
    key: 'rsvp_blocklist',
    value: JSON.stringify(BLOCKLIST),
    valueType: 'json',
    description: 'Normalized full names that cannot RSVP (managed discreetly)',
  },
  update: { value: JSON.stringify(merged) },
})
console.log('Blocklist seeded:', JSON.parse(row.value).length, 'entries')
await prisma.$disconnect()
