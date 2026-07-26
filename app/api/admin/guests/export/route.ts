import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NOT_AWAITING_REVIEW } from '@/lib/review'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const guests = await prisma.guest.findMany({
      where: NOT_AWAITING_REVIEW,
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    })

    // Columns Nicolle asked to drop (2026-07-25) because they were empty in every
    // row of her export: Partner Email, Invitation Code, Invitation Sent, Plus Ones
    // Count, Plus Ones Names, Special Requests, Notes. The underlying fields still
    // exist — only the export stopped carrying them.
    // Preferred Name sits after the partner names to match the Edit modal's layout.
    const headers = [
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
      'Created Date'
    ]

    const csvRows = [headers.join(',')]

    guests.forEach(guest => {
      const row = [
        escapeCSV(guest.firstName),
        escapeCSV(guest.lastName),
        escapeCSV(guest.email || ''),
        escapeCSV(guest.partnerFirstName || ''),
        escapeCSV(guest.partnerLastName || ''),
        escapeCSV(guest.preferredName || ''),
        escapeCSV(guest.phone || ''),
        escapeCSV(guest.addressLine1 || ''),
        escapeCSV(guest.addressLine2 || ''),
        escapeCSV(guest.city || ''),
        escapeCSV(guest.state || ''),
        escapeCSV(guest.zipCode || ''),
        escapeCSV(guest.country || ''),
        guest.rsvpReceivedAt ? new Date(guest.rsvpReceivedAt).toLocaleDateString() : '',
        guest.attending === null ? '' : (guest.attending ? 'Yes' : 'No'),
        escapeCSV(guest.dietaryRestrictions || ''),
        escapeCSV(guest.songRequest || ''),
        guest.tableNumber?.toString() || '',
        new Date(guest.createdAt).toLocaleDateString()
      ]

      csvRows.push(row.join(','))
    })

    const csvContent = csvRows.join('\n')
    const fileName = `wedding-guests-${new Date().toISOString().split('T')[0]}.csv`

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    })

  } catch (error) {
    console.error('Error exporting guests:', error)
    return NextResponse.json(
      { error: 'Failed to export guest list' },
      { status: 500 }
    )
  }
}

function escapeCSV(str: string): string {
  if (!str) return ''
  
  // If the string contains commas, quotes, or newlines, wrap it in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  
  return str
}