import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { sendEmail } from "./email"

// Hardcoded admin credentials
const ADMIN_CREDENTIALS = {
  email: 'admin@walters-pierce-wedding.com',
  password: 'Kund@lini12'
}

const SUPER_ADMIN_EMAIL = 'whitney.walters@gmail.com'
const MAX_LOGIN_ATTEMPTS = 3
const LOCKOUT_DURATION = 30 * 60 * 1000 // 30 minutes

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
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
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

        // Super admin bypass - always allow whitney.walters@gmail.com
        if (email === SUPER_ADMIN_EMAIL) {
          const isValidSuperAdmin = credentials.password === ADMIN_CREDENTIALS.password

          recordLoginAttempt(email, isValidSuperAdmin)

          if (isValidSuperAdmin) {
            return {
              id: 'super-admin',
              email: SUPER_ADMIN_EMAIL,
              role: 'admin',
            }
          }
          return null
        }

        // Check hardcoded admin credentials
        if (email === ADMIN_CREDENTIALS.email && credentials.password === ADMIN_CREDENTIALS.password) {
          recordLoginAttempt(email, true)
          return {
            id: 'admin',
            email: ADMIN_CREDENTIALS.email,
            role: 'admin',
          }
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