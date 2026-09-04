/**
 * Covers the built-in admin logins reading ADMIN_PASSWORD from the environment:
 * they work when it is set, and are disabled (rather than falling back to a
 * value in the source) when it is not. Database users are unaffected.
 */
import bcrypt from 'bcryptjs'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '../prisma'

jest.mock('next-auth/providers/credentials', () => jest.fn(options => ({ ...options, name: 'credentials' })))
jest.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: jest.fn() }))
jest.mock('../prisma', () => ({ prisma: { user: { findUnique: jest.fn() } } }))
jest.mock('bcryptjs', () => ({ compare: jest.fn() }))
jest.mock('../email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }))

const SUPER_ADMIN = 'whitney.walters@gmail.com'
const SHARED_ADMIN = 'admin@walters-pierce-wedding.com'

// The module reads ADMIN_PASSWORD at import time, so each case re-imports it
// with the environment it wants.
function loadAuthorize(adminPassword?: string) {
  let authorize: any
  jest.isolateModules(() => {
    if (adminPassword === undefined) {
      delete process.env.ADMIN_PASSWORD
    } else {
      process.env.ADMIN_PASSWORD = adminPassword
    }
    require('../auth')
    const calls = (CredentialsProvider as unknown as jest.Mock).mock.calls
    authorize = calls[calls.length - 1][0].authorize
  })
  return authorize
}

const originalAdminPassword = process.env.ADMIN_PASSWORD

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
})

afterEach(() => {
  jest.restoreAllMocks()
})

afterAll(() => {
  if (originalAdminPassword === undefined) {
    delete process.env.ADMIN_PASSWORD
  } else {
    process.env.ADMIN_PASSWORD = originalAdminPassword
  }
})

describe('built-in admin logins with ADMIN_PASSWORD set', () => {
  it('signs in the super admin', async () => {
    const authorize = loadAuthorize('env-secret')
    const result = await authorize({ email: SUPER_ADMIN, password: 'env-secret' }, {} as any)
    expect(result).toEqual({ id: 'super-admin', email: SUPER_ADMIN, role: 'admin' })
  })

  it('signs in the shared admin account', async () => {
    const authorize = loadAuthorize('env-secret')
    const result = await authorize({ email: SHARED_ADMIN, password: 'env-secret' }, {} as any)
    expect(result).toEqual({ id: 'admin', email: SHARED_ADMIN, role: 'admin' })
  })

  it('rejects the wrong password', async () => {
    const authorize = loadAuthorize('env-secret')
    expect(await authorize({ email: SUPER_ADMIN, password: 'wrong' }, {} as any)).toBeNull()
  })
})

describe('built-in admin logins with ADMIN_PASSWORD unset', () => {
  it('does not accept a password removed from the source', async () => {
    const authorize = loadAuthorize(undefined)
    expect(await authorize({ email: SUPER_ADMIN, password: 'Kund@lini12' }, {} as any)).toBeNull()
    expect(await authorize({ email: SHARED_ADMIN, password: 'Kund@lini12' }, {} as any)).toBeNull()
  })

  it('does not treat an empty or undefined password as a match', async () => {
    const authorize = loadAuthorize(undefined)
    expect(await authorize({ email: SUPER_ADMIN, password: '' }, {} as any)).toBeNull()
    expect(await authorize({ email: SUPER_ADMIN }, {} as any)).toBeNull()
  })

  it('logs an explanation to the server logs', async () => {
    const authorize = loadAuthorize(undefined)
    await authorize({ email: SUPER_ADMIN, password: 'anything' }, {} as any)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('ADMIN_PASSWORD is not set'))
  })

  it('still signs in a database admin user, including the super admin address', async () => {
    const authorize = loadAuthorize(undefined)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'db-user-1',
      email: SUPER_ADMIN,
      passwordHash: 'hashed',
      role: 'admin',
    })
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

    const result = await authorize({ email: SUPER_ADMIN, password: 'db-password' }, {} as any)
    expect(result).toEqual({ id: 'db-user-1', email: SUPER_ADMIN, role: 'admin' })
  })
})
