import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const TIERS = [
  { title: 'Buy us Coffee',            description: 'Fuel a cozy Irish morning.',            targetAmount: 25,   category: 'dining',        sortOrder: 1 },
  { title: 'Buy us Breakfast',         description: 'A hearty start before the day’s adventures.', targetAmount: 50, category: 'dining',   sortOrder: 2 },
  { title: 'Buy us Lunch',             description: 'A midday bite between the sights.',      targetAmount: 75,   category: 'dining',        sortOrder: 3 },
  { title: 'Buy us Dinner',            description: 'A romantic dinner out in Ireland.',      targetAmount: 100,  category: 'dining',        sortOrder: 4 },
  { title: 'Buy us a Round of Golf',   description: 'A round on an emerald Irish course.',    targetAmount: 250,  category: 'activities',    sortOrder: 5 },
  { title: 'Help us pay for the Flight', description: 'Chip in any amount toward our flights to Ireland.', targetAmount: 2000, category: 'flights', sortOrder: 6 },
  { title: 'Help us pay for the Hotel', description: 'A night in our honeymoon hotel.',       targetAmount: 500,  category: 'accommodation', sortOrder: 7 },
]

for (const t of TIERS) {
  const existing = await prisma.registryItem.findFirst({ where: { title: t.title } })
  if (existing) { console.log('skip (exists):', t.title); continue }
  await prisma.registryItem.create({ data: { ...t, isActive: true } })
  console.log('created:', t.title)
}
await prisma.$disconnect()
