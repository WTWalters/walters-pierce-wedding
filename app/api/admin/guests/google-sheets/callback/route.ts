import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(new URL(`/admin/guests?error=${encodeURIComponent('Google authorization failed')}`, request.url))
    }

    if (!code) {
      return NextResponse.redirect(new URL(`/admin/guests?error=${encodeURIComponent('No authorization code received')}`, request.url))
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Create Google Sheets service
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client })

    // Create a new spreadsheet
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: `Wedding Guests - ${new Date().toLocaleDateString()}`
        }
      }
    })

    const spreadsheetId = spreadsheet.data.spreadsheetId

    if (!spreadsheetId) {
      throw new Error('Failed to create spreadsheet')
    }

    // Fetch guest data
    const guests = await prisma.guest.findMany({
      include: {
        plusOnes: true
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    })

    // Prepare data for Google Sheets
    const headers = [
      'First Name',
      'Last Name', 
      'Email',
      'Phone',
      'Address',
      'City',
      'State',
      'Zip Code',
      'Invitation Code',
      'Invitation Sent',
      'RSVP Received',
      'Attending',
      'Plus Ones',
      'Dietary Restrictions',
      'Notes'
    ]

    const rows = guests.map(guest => [
      guest.firstName,
      guest.lastName,
      guest.email,
      guest.phone || '',
      guest.addressLine1 || '',
      guest.city || '',
      guest.state || '',
      guest.zipCode || '',
      guest.invitationCode || '',
      guest.invitationSentAt ? new Date(guest.invitationSentAt).toLocaleDateString() : '',
      guest.rsvpReceivedAt ? new Date(guest.rsvpReceivedAt).toLocaleDateString() : '',
      guest.attending === null ? '' : (guest.attending ? 'Yes' : 'No'),
      guest.plusOnes.map(po => `${po.firstName} ${po.lastName}`).join(', '),
      guest.dietaryRestrictions || '',
      guest.notes || ''
    ])

    // Write data to spreadsheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'A1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers, ...rows]
      }
    })

    // Format the header row
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.6, blue: 0.2 },
                  textFormat: { 
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    bold: true 
                  }
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)'
            }
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: headers.length
              }
            }
          }
        ]
      }
    })

    // Store the spreadsheet info (you could save this to database for future updates)
    // For now, just redirect with success message and spreadsheet URL
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
    
    return NextResponse.redirect(new URL(`/admin/guests?success=${encodeURIComponent('Google Sheets created successfully!')}&sheet=${encodeURIComponent(spreadsheetUrl)}`, request.url))

  } catch (error) {
    console.error('Error in Google Sheets callback:', error)
    return NextResponse.redirect(new URL(`/admin/guests?error=${encodeURIComponent('Failed to create Google Sheets')}`, request.url))
  }
}