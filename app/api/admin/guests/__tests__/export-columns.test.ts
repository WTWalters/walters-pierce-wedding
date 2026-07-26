jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {
    body: unknown
    status: number
    headers: Record<string, string>
    constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this.body = body
      this.status = init?.status ?? 200
      this.headers = init?.headers ?? {}
    }
    static json(body: unknown, init?: { status?: number }) {
      return { body, status: init?.status ?? 200 }
    }
  },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { guest: { findMany: jest.fn() } } }))

import { getServerSession } from 'next-auth'
import { GET } from '../export/route'
import { prisma } from '@/lib/prisma'

const GUEST = {
  firstName: 'Muriel',
  lastName: 'Addington',
  email: 'muriel3063@gmail.com',
  preferredName: 'Grandma',
  partnerFirstName: 'Sharon',
  partnerLastName: 'LeVeque',
  phone: '(303) 506-0000',
  addressLine1: '8 Lori Drive',
  addressLine2: null,
  city: 'Fayetteville',
  state: 'TN',
  zipCode: '37334',
  country: 'USA',
  rsvpReceivedAt: new Date('2026-07-20T00:00:00.000Z'),
  attending: true,
  dietaryRestrictions: 'None',
  songRequest: 'Perfect by Ed Sheeran',
  tableNumber: 4,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  // Retired columns — still on the record, must not reach the CSV.
  partnerEmail: 'partner@example.com',
  invitationCode: 'ABC123',
  invitationSentAt: new Date('2026-07-02T00:00:00.000Z'),
  specialRequests: 'a special request',
  notes: 'some notes',
}

async function exportCsv(): Promise<string> {
  const res = (await GET({ url: 'http://x' } as never)) as unknown as { body: string }
  return res.body
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
  ;(prisma.guest.findMany as jest.Mock).mockResolvedValue([GUEST])
})

// Nicolle, 2026-07-25: drop the empty columns, add Preferred Name.
it('exports exactly the columns Nicolle asked for, in order', async () => {
  const header = (await exportCsv()).split('\n')[0]
  expect(header.split(',')).toEqual([
    'First Name',
    'Last Name',
    'Email',
    'Partner First Name',
    'Partner Last Name',
    'Preferred Name',
    'Phone',
    'Address Line 1',
    'Address Line 2',
    'City',
    'State',
    'Zip Code',
    'Country',
    'RSVP Received',
    'Attending',
    'Dietary Restrictions',
    'Favorite Song',
    'Table Number',
    'Created Date',
  ])
})

// Nicolle: "I would love to be able to see Favorite Song on ... *.csv file download".
it('writes the song request into the Favorite Song column', async () => {
  const [header, row] = (await exportCsv()).split('\n')
  const columns = header.split(',')
  expect(row.split(',')[columns.indexOf('Favorite Song')]).toBe('Perfect by Ed Sheeran')
})

it.each([
  'Partner Email',
  'Invitation Code',
  'Invitation Sent',
  'Plus Ones Count',
  'Plus Ones Names',
  'Special Requests',
  'Notes',
])('no longer exports the "%s" column', async (column) => {
  const header = (await exportCsv()).split('\n')[0]
  expect(header.split(',')).not.toContain(column)
})

// A retired column whose data still lives on the record must not leak through
// under a neighbouring heading — that's what a header/row mismatch looks like.
it('omits retired values from the row, not just the header', async () => {
  const csv = await exportCsv()
  for (const leaked of ['partner@example.com', 'ABC123', 'a special request', 'some notes']) {
    expect(csv).not.toContain(leaked)
  }
})

it('keeps every row aligned with the header', async () => {
  const [header, row] = (await exportCsv()).split('\n')
  expect(row.split(',')).toHaveLength(header.split(',').length)
})

it('writes the preferred name into the Preferred Name column', async () => {
  const [header, row] = (await exportCsv()).split('\n')
  const columns = header.split(',')
  expect(row.split(',')[columns.indexOf('Preferred Name')]).toBe('Grandma')
})

// Nicolle: "sort on first name instead of last?" — the file leads with First Name,
// so surname order read as no order at all.
it('sorts rows by first name, then last name', async () => {
  await exportCsv()
  const args = (prisma.guest.findMany as jest.Mock).mock.calls[0][0]
  expect(args.orderBy).toEqual([{ firstName: 'asc' }, { lastName: 'asc' }])
})

// plusOnes was only included for the two Plus Ones columns.
it('stops joining the plusOnes relation it no longer needs', async () => {
  await exportCsv()
  const args = (prisma.guest.findMany as jest.Mock).mock.calls[0][0]
  expect(args).not.toHaveProperty('include')
})
