// scripts/seed-wedding-details.mjs
// Seeds the wedding_details Setting used by the RSVP-Yes email. Idempotent (upsert).
// Run locally: node scripts/seed-wedding-details.mjs
// Prod: DATABASE_URL=<public> node scripts/seed-wedding-details.mjs (see registry seed note)
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const details = {
  date: 'TBA',
  time: 'TBA',
  venueName: 'Blackstone Rivers Ranch',
  venueAddress: '3673 Chicago Creek Rd\nIdaho Springs, CO 80452',
}

await prisma.setting.upsert({
  where: { key: 'wedding_details' },
  update: { value: JSON.stringify(details) },
  create: { key: 'wedding_details', value: JSON.stringify(details) },
})
console.log('Seeded wedding_details:', details.venueName)
await prisma.$disconnect()
