import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// Full honeymoon-registry tier list. Upserts by title:
// existing rows are updated (price/target/desc/order) WITHOUT touching amountRaised;
// new rows are created. Safe to re-run.
const TIERS = [
  { title: 'Buy us Coffee',                       description: 'Fuel a cozy Irish morning.',                        targetAmount: 25,   category: 'dining',        sortOrder: 1 },
  { title: 'Buy us Breakfast',                     description: 'A hearty start before the day’s adventures.',       targetAmount: 50,   category: 'dining',        sortOrder: 2 },
  { title: 'Buy us Lunch',                         description: 'A midday bite between the sights.',                 targetAmount: 75,   category: 'dining',        sortOrder: 3 },
  { title: 'Buy us Dinner',                        description: 'A romantic dinner out in Ireland.',                targetAmount: 100,  category: 'dining',        sortOrder: 4 },
  { title: 'Buy us a Round of Golf',               description: 'A round on an emerald Irish course.',              targetAmount: 85,   category: 'activities',    sortOrder: 5 },
  { title: 'Tour of the Guinness Storehouse',      description: 'A pint with a view at the source.',                targetAmount: 100,  category: 'activities',    sortOrder: 6 },
  { title: 'Tour of St. Patrick’s Cathedral',      description: 'Ireland’s largest cathedral, up close.',           targetAmount: 25,   category: 'activities',    sortOrder: 7 },
  { title: 'Tour of Teeling Whiskey Distillery',   description: 'A taste of Dublin’s craft whiskey.',               targetAmount: 70,   category: 'activities',    sortOrder: 8 },
  { title: 'Tour of Malahide',                     description: 'The castle and village north of Dublin.',          targetAmount: 40,   category: 'activities',    sortOrder: 9 },
  { title: 'A Tank of Gas',                        description: 'Keep the road trip rolling.',                      targetAmount: 30,   category: 'other',         sortOrder: 10 },
  { title: 'Train Tickets to Howth',               description: 'A seaside day trip by rail.',                      targetAmount: 20,   category: 'other',         sortOrder: 11 },
  { title: 'Help us pay for the Flight',           description: 'Chip in toward our flights to Ireland — pick an amount.', targetAmount: 2000, category: 'flights',       sortOrder: 12 },
  { title: 'Help us pay for the Hotel',            description: 'Help cover our honeymoon hotel — pick an amount.',  targetAmount: 1300, category: 'accommodation', sortOrder: 13 },
]

for (const t of TIERS) {
  const existing = await prisma.registryItem.findFirst({ where: { title: t.title } })
  if (existing) {
    await prisma.registryItem.update({
      where: { id: existing.id },
      data: { description: t.description, targetAmount: t.targetAmount, category: t.category, sortOrder: t.sortOrder, isActive: true },
    })
    console.log('updated:', t.title, '→ $' + t.targetAmount)
  } else {
    await prisma.registryItem.create({ data: { ...t, isActive: true } })
    console.log('created:', t.title, '→ $' + t.targetAmount)
  }
}
await prisma.$disconnect()
