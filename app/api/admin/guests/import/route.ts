import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const previewOnly = formData.get('preview') === 'true'
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Please upload a CSV file' },
        { status: 400 }
      )
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size too large. Maximum 5MB allowed.' },
        { status: 400 }
      )
    }

    const csvText = await file.text()
    const lines = csvText.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV file must contain at least a header row and one data row' },
        { status: 400 }
      )
    }

    // Parse header row
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    
    // Required fields
    const requiredFields = ['firstname', 'lastname', 'email']
    const missingFields = requiredFields.filter(field => 
      !headers.some(h => h.includes(field) || h.includes(field.replace('name', ' name')))
    )
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required columns: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    // Map column indices
    const fieldMap = {
      firstName: findColumnIndex(headers, ['firstname', 'first name', 'first_name']),
      lastName: findColumnIndex(headers, ['lastname', 'last name', 'last_name']),
      email: findColumnIndex(headers, ['email', 'email address']),
      phone: findColumnIndex(headers, ['phone', 'phone number', 'telephone']),
      addressLine1: findColumnIndex(headers, ['address', 'address1', 'address line 1', 'street']),
      addressLine2: findColumnIndex(headers, ['address2', 'address line 2']),
      city: findColumnIndex(headers, ['city']),
      state: findColumnIndex(headers, ['state', 'province']),
      zipCode: findColumnIndex(headers, ['zip', 'zipcode', 'zip code', 'postal code']),
      notes: findColumnIndex(headers, ['notes', 'comments'])
    }

    let imported = 0
    let skipped = 0
    const errors: string[] = []
    const previewData: Array<{ [key: string]: unknown; row: number; status: string; error?: string }> = []

    // Process data rows
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i])
        
        if (values.length === 0) continue // Skip empty lines
        
        const guestData = {
          firstName: getFieldValue(values, fieldMap.firstName),
          lastName: getFieldValue(values, fieldMap.lastName),
          email: getFieldValue(values, fieldMap.email),
          phone: getFieldValue(values, fieldMap.phone),
          addressLine1: getFieldValue(values, fieldMap.addressLine1),
          addressLine2: getFieldValue(values, fieldMap.addressLine2),
          city: getFieldValue(values, fieldMap.city),
          state: getFieldValue(values, fieldMap.state),
          zipCode: getFieldValue(values, fieldMap.zipCode),
          notes: getFieldValue(values, fieldMap.notes)
        }

        // Validate required fields
        if (!guestData.firstName || !guestData.lastName || !guestData.email) {
          errors.push(`Row ${i + 1}: Missing required fields (first name, last name, or email)`)
          skipped++
          if (previewOnly) {
            previewData.push({ ...guestData, row: i + 1, status: 'error', error: 'Missing required fields' })
          }
          continue
        }

        // Validate email format
        if (!isValidEmail(guestData.email)) {
          errors.push(`Row ${i + 1}: Invalid email format: ${guestData.email}`)
          skipped++
          if (previewOnly) {
            previewData.push({ ...guestData, row: i + 1, status: 'error', error: 'Invalid email format' })
          }
          continue
        }

        // For preview mode, add to preview data and continue
        if (previewOnly) {
          previewData.push({ ...guestData, row: i + 1, status: 'valid' })
          if (previewData.length >= 10) break // Limit preview to 10 rows
          continue
        }

        // Check if guest already exists
        const existingGuest = await prisma.guest.findUnique({
          where: { email: guestData.email }
        })

        if (existingGuest) {
          errors.push(`Row ${i + 1}: Guest with email ${guestData.email} already exists`)
          skipped++
          continue
        }

        // Create guest
        await prisma.guest.create({
          data: {
            firstName: guestData.firstName,
            lastName: guestData.lastName,
            email: guestData.email,
            phone: guestData.phone || null,
            addressLine1: guestData.addressLine1 || null,
            addressLine2: guestData.addressLine2 || null,
            city: guestData.city || null,
            state: guestData.state || null,
            zipCode: guestData.zipCode || null,
            notes: guestData.notes || null
          }
        })

        imported++

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Row ${i + 1}: ${errorMessage}`)
        skipped++
        if (previewOnly) {
          previewData.push({ row: i + 1, status: 'error', error: errorMessage })
        }
      }
    }

    // Return appropriate response based on mode
    if (previewOnly) {
      return NextResponse.json({
        success: true,
        preview: true,
        totalRows: lines.length - 1,
        previewData,
        errors: errors.slice(0, 10),
        columnMapping: fieldMap,
        detectedColumns: headers
      })
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors: errors.slice(0, 10), // Limit errors to first 10
      totalErrors: errors.length
    })

  } catch (error) {
    console.error('Error importing guests:', error)
    return NextResponse.json(
      { error: 'Failed to import CSV file' },
      { status: 500 }
    )
  }
}

function findColumnIndex(headers: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const index = headers.findIndex(h => h.includes(name))
    if (index !== -1) return index
  }
  return -1
}

function getFieldValue(values: string[], index: number): string {
  if (index === -1 || index >= values.length) return ''
  return values[index].trim()
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i++ // Skip next quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current)
  return result
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}