import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE - Delete a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = params.id

    // Check if user exists
    const userToDelete = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!userToDelete) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent deleting yourself
    if (userToDelete.id === session.user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    // Delete the user
    await prisma.user.delete({
      where: { id: userId }
    })

    // Log the action (skip if super admin with non-UUID id)
    const isValidUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(session.user.id)
    if (isValidUuid) {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'delete_admin_user',
          entityType: 'user',
          entityId: userId,
          oldValues: {
            email: userToDelete.email,
            role: userToDelete.role
          }
        }
      })
    }

    return NextResponse.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update user role
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = params.id
    const body = await request.json()
    const { role } = body

    if (!role || !['admin', 'guest'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Check if user exists
    const userToUpdate = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!userToUpdate) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent changing your own role
    if (userToUpdate.id === session.user.id) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })
    }

    // Update the user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: role as 'admin' | 'guest' },
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
          action: 'update_user_role',
          entityType: 'user',
          entityId: userId,
          oldValues: { role: userToUpdate.role },
          newValues: { role: updatedUser.role }
        }
      })
    }

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}