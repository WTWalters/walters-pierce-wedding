/**
 * Route-level tests for POST /api/admin/users: the admin guard, the optional
 * password (supplied vs. generated), and that the password is returned once so
 * it can be handed to the new admin.
 */
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}))
jest.mock('bcryptjs', () => ({ hash: jest.fn(async (p: string) => `hashed:${p}`) }))

import { POST } from '../route'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

const mockSession = getServerSession as jest.Mock
const mockPrisma = prisma as jest.Mocked<any>

const req = (body: unknown) => ({ json: async () => body }) as any

beforeEach(() => {
  jest.clearAllMocks()
  // A regular DB admin (not the super admin) — any admin may add another admin
  mockSession.mockResolvedValue({
    user: { id: '11111111-2222-3333-4444-555555555555', email: 'nicolle@example.com', role: 'admin' },
  })
  mockPrisma.user.findUnique.mockResolvedValue(null)
  mockPrisma.user.create.mockImplementation(async ({ data }: any) => ({
    id: 'u1',
    email: data.email,
    role: data.role,
    createdAt: new Date(),
    updatedAt: new Date(),
  }))
})

describe('POST /api/admin/users', () => {
  it('returns 401 when not an admin', async () => {
    mockSession.mockResolvedValue({ user: { role: 'guest' } })
    const res: any = await POST(req({ email: 'kelleen@example.com' }))
    expect(res.status).toBe(401)
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })

  it('rejects a password shorter than 6 characters', async () => {
    const res: any = await POST(req({ email: 'kelleen@example.com', password: 'abc' }))
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/at least 6 characters/)
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })

  it('rejects a duplicate email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' })
    const res: any = await POST(req({ email: 'kelleen@example.com' }))
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/already exists/)
  })

  it('stores the supplied password and returns it once', async () => {
    const res: any = await POST(req({
      email: 'Kelleen@Example.com',
      role: 'admin',
      password: 'WeddingGuest2026',
    }))

    expect(res.status).toBe(200)
    expect(res.body.initialPassword).toBe('WeddingGuest2026')
    expect(res.body.generatedPassword).toBe(false)
    expect(res.body.user.email).toBe('kelleen@example.com')
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'kelleen@example.com',
          passwordHash: 'hashed:WeddingGuest2026',
          role: 'admin',
        }),
      })
    )
  })

  it('generates a password when none is supplied', async () => {
    const res: any = await POST(req({ email: 'kelleen@example.com' }))

    expect(res.status).toBe(200)
    expect(res.body.generatedPassword).toBe(true)
    expect(typeof res.body.initialPassword).toBe('string')
    expect(res.body.initialPassword.length).toBeGreaterThan(0)
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: `hashed:${res.body.initialPassword}` }),
      })
    )
  })

  it('records an audit log entry for the creating admin', async () => {
    await POST(req({ email: 'kelleen@example.com', password: 'WeddingGuest2026' }))
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'create_admin_user', entityType: 'user' }),
      })
    )
  })
})
