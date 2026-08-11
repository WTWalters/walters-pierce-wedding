import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// GET - List all admin users
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    console.log('Session in admin/users:', session)

    if (!session || session.user.role !== 'admin') {
      console.log('Unauthorized access attempt:', { session: !!session, role: session?.user?.role })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new admin user
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, role = 'admin', password } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // A password may be supplied so it can be handed to the new admin directly;
    // otherwise one is generated below and returned in the response.
    if (password !== undefined && password !== '' && password.length < 6) {
      return NextResponse.json({
        error: 'Password must be at least 6 characters long'
      }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 })
    }

    // Use the supplied password, or generate one to hand to the new user
    const generatedPassword = !password
    const initialPassword = password || Math.random().toString(36).slice(-8)
    const hashedPassword = await bcrypt.hash(initialPassword, 12)

    // Create new user
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash: hashedPassword,
        role: role as 'admin' | 'guest'
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    })

    // Log the action (skip if super admin with non-UUID id)
    const isValidUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(session.user.id)
    if (isValidUuid) {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'create_admin_user',
          entityType: 'user',
          entityId: newUser.id,
          newValues: {
            email: newUser.email,
            role: newUser.role
          }
        }
      })
    }

    return NextResponse.json({
      user: newUser,
      // Returned once, at creation time, so the admin can pass the sign-in
      // details along — it is never retrievable afterwards.
      initialPassword,
      generatedPassword,
      message: `User created successfully. Sign-in password: ${initialPassword}`
    })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}