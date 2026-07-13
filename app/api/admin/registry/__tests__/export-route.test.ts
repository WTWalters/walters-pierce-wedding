jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {
    body: any; init: any
    constructor(body: any, init: any) { this.body = body; this.init = init }
  },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: { contribution: { findMany: jest.fn() } } }))

import { GET } from '../export/route'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
const mockSession = getServerSession as jest.Mock
const mockPrisma = prisma as jest.Mocked<any>

beforeEach(() => { jest.clearAllMocks(); mockSession.mockResolvedValue({ user: { role: 'admin' } }) })

it('emits CSV with a header and one row per contribution', async () => {
  mockPrisma.contribution.findMany.mockResolvedValue([
    { contributorName: 'Sue', contributorEmail: 's@x.com', amount: 100, message: 'Yay', thankYouSent: true, createdAt: new Date('2026-09-01T00:00:00Z'), registryItem: { title: 'Buy us Dinner' } },
  ])
  const res: any = await GET({} as any)
  const csv: string = res.body
  expect(csv.split('\n')[0]).toContain('Name')
  expect(csv).toContain('Buy us Dinner')
  expect(csv).toContain('Sue')
})
