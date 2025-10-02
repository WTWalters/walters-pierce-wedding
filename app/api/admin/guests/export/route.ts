import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all guests with their plus ones
    const guests = await prisma.guest.findMany({
      include: {
        plusOnes: true
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    })

    // Generate CSV content
    const headers = [
      'First Name',
      'Last Name', 
      'Email',
      'Phone',
      'Address Line 1',
      'Address Line 2',
      'City',
      'State',
      'Zip Code',
      'Country',
      'Invitation Code',
      'Invitation Sent',
      'RSVP Received',
      'Attending',
      'Plus Ones Count',
      'Plus Ones Names',
      'Dietary Restrictions',
      'Special Requests',
      'Table Number',
      'Notes',
      'Created Date'
    ]

    const csvRows = [headers.join(',')]

    guests.forEach(guest => {
      const plusOnesNames = guest.plusOnes
        .map(po => `${po.firstName} ${po.lastName}`)
        .join('; ')

      const row = [
        escapeCSV(guest.firstName),
        escapeCSV(guest.lastName),
        escapeCSV(guest.email),
        escapeCSV(guest.phone || ''),
        escapeCSV(guest.addressLine1 || ''),
        escapeCSV(guest.addressLine2 || ''),
        escapeCSV(guest.city || ''),
        escapeCSV(guest.state || ''),
        escapeCSV(guest.zipCode || ''),
        escapeCSV(guest.country || ''),
        escapeCSV(guest.invitationCode || ''),
        guest.invitationSentAt ? new Date(guest.invitationSentAt).toLocaleDateString() : '',
        guest.rsvpReceivedAt ? new Date(guest.rsvpReceivedAt).toLocaleDateString() : '',
        guest.attending === null ? '' : (guest.attending ? 'Yes' : 'No'),
        guest.plusOnes.length.toString(),
        escapeCSV(plusOnesNames),
        escapeCSV(guest.dietaryRestrictions || ''),
        escapeCSV(guest.specialRequests || ''),
        guest.tableNumber?.toString() || '',
        escapeCSV(guest.notes || ''),
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