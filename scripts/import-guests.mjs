// One-time: purge test-fixture guests, import MailerLite save-the-date emails
// as source='imported' with empty names (names fill in at RSVP time).
// Usage: node scripts/import-guests.mjs   (locally)
//        railway run node scripts/import-guests.mjs   (against production)
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'

config({ path: '.env.local' })
const prisma = new PrismaClient()

// The 10 fixture rows verified in the dev database on 2026-07-01:
// 9 @example.com addresses + testy@gmail.com
const fixtures = await prisma.guest.findMany({
  where: { OR: [{ email: { endsWith: '@example.com' } }, { email: 'testy@gmail.com' }] },
  select: { id: true, email: true },
})
const fixtureIds = fixtures.map((g) => g.id)
if (fixtureIds.length) {
  await prisma.emailLog.deleteMany({ where: { guestId: { in: fixtureIds } } })
  await prisma.plusOne.deleteMany({ where: { guestId: { in: fixtureIds } } })
  const del = await prisma.guest.deleteMany({ where: { id: { in: fixtureIds } } })
  console.log('Purged fixtures:', del.count, fixtures.map((g) => g.email).join(', '))
}

const lines = readFileSync('data/mailerlite_subscribers.csv', 'utf8').trim().split('\n').slice(1)
const emails = [...new Set(lines.map((l) => l.split(',')[0].trim().toLowerCase()).filter(Boolean))]

let created = 0
for (const email of emails) {
  const existing = await prisma.guest.findUnique({ where: { email } })
  if (existing) continue
  await prisma.guest.create({
    data: { email, firstName: '', lastName: '', source: 'imported' },
  })
  created++
}
const total = await prisma.guest.count()
console.log(`Imported ${created} new guests. Guest table total: ${total}`)
await prisma.$disconnect()
