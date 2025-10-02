import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Generate CSV template
    const headers = [
      'First Name',
      'Last Name', 
      'Email',
      'Phone',
      'Address',
      'Address Line 2',
      'City',
      'State',
      'Zip Code',
      'Notes'
    ]

    const sampleRows = [
      ['John', 'Doe', 'john.doe@example.com', '(555) 123-4567', '123 Main St', '', 'Anytown', 'CA', '12345', 'College friend'],
      ['Jane', 'Smith', 'jane.smith@example.com', '(555) 987-6543', '456 Oak Ave', 'Apt 2B', 'Somewhere', 'TX', '67890', 'Work colleague'],
      ['Bob', 'Johnson', 'bob.johnson@example.com', '(555) 456-7890', '789 Pine St', '', 'Elsewhere', 'NY', '34567', 'Family friend']
    ]

    const csvRows = [headers.join(',')]
    sampleRows.forEach(row => {
      csvRows.push(row.join(','))
    })

    const csvContent = csvRows.join('\n')
    const fileName = 'guest-import-template.csv'

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    })

  } catch (error) {
    console.error('Error generating template:', error)
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    )
  }
}