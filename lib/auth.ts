import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { sendEmail } from "./email"

// The wedding's primary admin. Used only to suppress self-notification on
// lockout — this account authenticates against the database like any other.
const SUPER_ADMIN_EMAIL = 'whitney.walters@gmail.com'
const MAX_LOGIN_ATTEMPTS = 3
const LOCKOUT_DURATION = 30 * 60 * 1000 // 30 minutes

// NextAuth signs every session JWT with this secret. An empty or placeholder
// value lets an attacker forge an admin token, so we hard-fail on it.
const PLACEHOLDER_SECRET = 'your-secret-key-here-change-in-production'

function assertStrongAuthSecret() {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret || secret === PLACEHOLDER_SECRET) {
    throw new Error(
      'NEXTAUTH_SECRET is not set to a strong value. Generate one with ' +
        '`openssl rand -base64 32` and set it in the environment.'
    )
  }
}

// In-memory storage for login attempts (in production, use Redis or database)
const loginAttempts = new Map<string, { count: number; lastAttempt: number; lockedUntil?: number }>()

function checkLoginAttempts(email: string): { allowed: boolean; remainingAttempts?: number } {
  const attempts = loginAttempts.get(email)

  if (!attempts) {
    return { allowed: true }
  }

  // Check if lockout period has expired
  if (attempts.lockedUntil && Date.now() > attempts.lockedUntil) {
    loginAttempts.delete(email)
    return { allowed: true }
  }

  // Check if user is locked out
  if (attempts.lockedUntil && Date.now() <= attempts.lockedUntil) {
    return { allowed: false }
  }

  // Check if max attempts reached
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    // Lock the account
    attempts.lockedUntil = Date.now() + LOCKOUT_DURATION
    loginAttempts.set(email, attempts)

    // Send notification email if not super admin
    if (email !== SUPER_ADMIN_EMAIL) {
      sendSecurityNotification(email).catch(console.error)
    }

    return { allowed: false }
  }

  return {
    allowed: true,
    remainingAttempts: MAX_LOGIN_ATTEMPTS - attempts.count
  }
}

function recordLoginAttempt(email: string, success: boolean) {
  if (success) {
    // Clear attempts on successful login
    loginAttempts.delete(email)
    return
  }

  const attempts = loginAttempts.get(email) || { count: 0, lastAttempt: 0 }
  attempts.count += 1
  attempts.lastAttempt = Date.now()
  loginAttempts.set(email, attempts)
}

async function sendSecurityNotification(attemptedEmail: string) {
  try {
    await sendEmail({
      to: SUPER_ADMIN_EMAIL,
      subject: '🔒 Admin Login Security Alert - Walters-Pierce Wedding',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Security Alert</h2>
          <p>Multiple failed login attempts detected for the wedding admin panel.</p>

          <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <strong>Attempted Email:</strong> ${attemptedEmail}<br>
            <strong>Time:</strong> ${new Date().toLocaleString()}<br>
            <strong>Action:</strong> Account temporarily locked for 30 minutes
          </div>

          <p>The account has been automatically locked for 30 minutes. If this was you, please wait and try again later.</p>

          <p>If this was not an authorized attempt, please review your admin access and consider changing passwords.</p>

          <hr style="margin: 24px 0;">
          <p style="color: #6b7280; font-size: 12px;">This is an automated security notification from the Walters-Pierce Wedding website admin system.</p>
        </div>
      `,
      text: `Security Alert: Multiple failed login attempts for ${attemptedEmail} at ${new Date().toLocaleString()}. Account locked for 30 minutes.`
    })
  } catch (error) {
    console.error('Failed to send security notification:', error)
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Fail closed if the JWT signing secret is missing or still the placeholder.
        assertStrongAuthSecret()

        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email.toLowerCase().trim()

        // Check login attempts and lockout
        const { allowed } = checkLoginAttempts(email)
        if (!allowed) {
          recordLoginAttempt(email, false)
          return null
        }

        // All admins (including the primary one) authenticate against the database.
        try {
          const user = await prisma.user.findUnique({
            where: { email }
          })

          if (user && user.passwordHash) {
            const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash)
            recordLoginAttempt(email, isValidPassword)

            if (isValidPassword) {
              return {
                id: user.id,
                email: user.email,
                role: user.role,
              }
            }
          }
        } catch (error) {
          console.error('Database authentication error:', error)
        }

        // Record failed attempt
        recordLoginAttempt(email, false)
        return null
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.sub!
        session.user.role = token.role as string
      }
      return session
    }
  },
  pages: {
    signIn: "/auth/login",
  }
}