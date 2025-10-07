import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// POST - Update user password
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, currentPassword, newPassword, confirmPassword } = body

    // Validation
    if (!userId || !newPassword || !confirmPassword) {
      return NextResponse.json({
        error: 'User ID, new password, and confirm password are required'
      }, { status: 400 })
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({
        error: 'New password and confirm password do not match'
      }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({
        error: 'Password must be at least 6 characters long'
      }, { status: 400 })
    }

    // Find the user
    const userToUpdate = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!userToUpdate) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // If updating your own password, verify current password
    if (userToUpdate.id === session.user.id) {
      if (!currentPassword) {
        return NextResponse.json({
          error: 'Current password is required when updating your own password'
        }, { status: 400 })
      }

      // Verify current password
      if (userToUpdate.passwordHash) {
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userToUpdate.passwordHash)
        if (!isCurrentPasswordValid) {
          return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
        }
      }
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12)

    // Update the password
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashedNewPassword,
        updatedAt: new Date()
      }
    })

    // Log the action (skip if super admin with non-UUID id)
    const isValidUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(session.user.id)
    if (isValidUuid) {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'update_user_password',
          entityType: 'user',
          entityId: userId,
          newValues: {
            passwordUpdated: true,
            updatedBy: session.user.email,
            targetUser: userToUpdate.email
          }
        }
      })
    }

    return NextResponse.json({
      message: 'Password updated successfully'
    })
  } catch (error) {
    console.error('Error updating password:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}