/**
 * Bootstrap (create or reset) a single admin user from environment variables.
 *
 * No passwords are committed to the repo. Provide them at run time:
 *
 *   Local:
 *     ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-strong-password' \
 *       node scripts/seed-admin-users.js
 *
 *   Production (Railway):
 *     ADMIN_EMAIL=whitney.walters@gmail.com ADMIN_PASSWORD='a-long-strong-password' \
 *       railway run node scripts/seed-admin-users.js
 *
 * Re-running with the same email resets that admin's password (upsert), so this
 * doubles as a password-reset tool. Run this BEFORE deploying the auth change
 * that removes the old hardcoded login, or you will be locked out of the admin.
 */
require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const MIN_PASSWORD_LENGTH = 12

async function bootstrapAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase().trim()
  const password = process.env.ADMIN_PASSWORD || ''

  if (!email || !email.includes('@')) {
    throw new Error('ADMIN_EMAIL is required and must be a valid email address.')
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD is required and must be at least ${MIN_PASSWORD_LENGTH} characters.`
    )
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: 'admin' },
    create: { email, passwordHash, role: 'admin' },
  })

  console.log(`✅ Admin ready: ${user.email} (role: ${user.role})`)
  console.log('   Password set from $ADMIN_PASSWORD (not logged).')
}

bootstrapAdmin()
  .catch((e) => {
    console.error(`❌ ${e.message}`)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
