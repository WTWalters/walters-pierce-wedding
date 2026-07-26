import {
  GUEST_CSV_COLUMNS,
  DEFAULT_GUEST_CSV_KEYS,
  buildGuestCsv,
  escapeCsv,
  guestCsvFilename,
} from '@/lib/guest-csv'

const GUEST = {
  firstName: 'Muriel',
  lastName: 'Addington',
  email: 'muriel3063@gmail.com',
  preferredName: 'Grandma',
  partnerFirstName: 'Sharon',
  partnerLastName: 'LeVeque',
  phone: '(303) 506-0000',
  addressLine1: '8 Lori Drive',
  addressLine2: null,
  city: 'Fayetteville',
  state: 'TN',
  zipCode: '37334',
  country: 'USA',
  rsvpReceivedAt: new Date('2026-07-20T12:00:00.000Z'),
  attending: true,
  dietaryRestrictions: 'None',
  songRequest: 'Perfect by Ed Sheeran',
  tableNumber: 4,
  createdAt: new Date('2026-07-01T12:00:00.000Z'),
  reservedSeats: 2,
  rsvpdCount: 2,
  specialRequests: 'a special request',
  notes: 'some notes',
}

const header = (csv: string) => csv.split('\n')[0].split(',')
const cell = (csv: string, column: string) => {
  const [head, row] = csv.split('\n')
  return row.split(',')[head.split(',').indexOf(column)]
}

describe('the default column set', () => {
  // The set Nicolle arrived at after two rounds of asks.
  it('is exactly the columns she asked for, in order', () => {
    const csv = buildGuestCsv([], DEFAULT_GUEST_CSV_KEYS)
    expect(header(csv)).toEqual([
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
      'Created Date',
    ])
  })

  it.each([
    'Partner Email',
    'Invitation Code',
    'Invitation Sent',
    'Plus Ones Count',
    'Plus Ones Names',
    'Special Requests',
    'Notes',
  ])('leaves "%s" out by default', (column) => {
    expect(header(buildGuestCsv([], DEFAULT_GUEST_CSV_KEYS))).not.toContain(column)
  })

  // Removed for being empty, but now reachable through the picker rather than by email.
  it.each(['Special Requests', 'Notes', 'Reserved Seats', "Number RSVP'd"])(
    'still offers "%s" as an opt-in column',
    (column) => {
      expect(GUEST_CSV_COLUMNS.map((c) => c.header)).toContain(column)
    }
  )

  it('has no duplicate keys or headers', () => {
    const keys = GUEST_CSV_COLUMNS.map((c) => c.key)
    const headers = GUEST_CSV_COLUMNS.map((c) => c.header)
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(headers).size).toBe(headers.length)
  })
})

describe('rendering rows', () => {
  it('keeps every row aligned with the header', () => {
    const csv = buildGuestCsv([GUEST, GUEST], DEFAULT_GUEST_CSV_KEYS)
    const lines = csv.split('\n')
    expect(lines).toHaveLength(3)
    for (const line of lines.slice(1)) {
      expect(line.split(',')).toHaveLength(header(csv).length)
    }
  })

  it('writes each value under its own heading', () => {
    const csv = buildGuestCsv([GUEST], DEFAULT_GUEST_CSV_KEYS)
    expect(cell(csv, 'Preferred Name')).toBe('Grandma')
    expect(cell(csv, 'Favorite Song')).toBe('Perfect by Ed Sheeran')
    expect(cell(csv, 'Attending')).toBe('Yes')
    expect(cell(csv, 'Table Number')).toBe('4')
  })

  it('leaves Attending blank for a guest who has not answered', () => {
    const csv = buildGuestCsv([{ ...GUEST, attending: null }], DEFAULT_GUEST_CSV_KEYS)
    expect(cell(csv, 'Attending')).toBe('')
  })

  it('renders a declining guest as No, not blank', () => {
    const csv = buildGuestCsv([{ ...GUEST, attending: false }], DEFAULT_GUEST_CSV_KEYS)
    expect(cell(csv, 'Attending')).toBe('No')
  })

  // A column that is deselected must not leak its value under a neighbouring
  // heading — that is what a header/row mismatch looks like in a spreadsheet.
  it('omits deselected values from the row, not just the header', () => {
    const csv = buildGuestCsv([GUEST], ['firstName', 'lastName'])
    expect(header(csv)).toEqual(['First Name', 'Last Name'])
    for (const leaked of ['some notes', 'a special request', 'Perfect by Ed Sheeran', 'Grandma']) {
      expect(csv).not.toContain(leaked)
    }
  })

  it('emits a header-only file when there are no guests', () => {
    expect(buildGuestCsv([], DEFAULT_GUEST_CSV_KEYS).split('\n')).toHaveLength(1)
  })
})

describe('the selection is not trusted blindly', () => {
  // Column order is canonical, so a shuffled or stale saved selection can't scramble
  // the file — which would silently move data under the wrong headings.
  it('follows the canonical order regardless of the selection order', () => {
    const csv = buildGuestCsv([GUEST], ['songRequest', 'firstName', 'email'])
    expect(header(csv)).toEqual(['First Name', 'Email', 'Favorite Song'])
  })

  it('ignores keys it does not recognise instead of emitting a blank column', () => {
    const csv = buildGuestCsv([GUEST], ['firstName', 'partnerEmail', 'nope'])
    expect(header(csv)).toEqual(['First Name'])
  })

  it('produces no columns when nothing is selected', () => {
    expect(buildGuestCsv([GUEST], [])).toBe('\n')
  })
})

describe('escapeCsv', () => {
  it('quotes values containing a comma', () => {
    expect(escapeCsv('Erie, CO')).toBe('"Erie, CO"')
  })

  it('doubles embedded quotes', () => {
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""')
  })

  it('quotes values containing a newline', () => {
    expect(escapeCsv('line one\nline two')).toBe('"line one\nline two"')
  })

  it('leaves plain values untouched', () => {
    expect(escapeCsv('Fayetteville')).toBe('Fayetteville')
  })

  // A dietary note like "peanuts, dairy" must not become two columns.
  it('keeps a comma-bearing cell in one column', () => {
    const csv = buildGuestCsv(
      [{ ...GUEST, dietaryRestrictions: 'peanuts, dairy, shellfish' }],
      DEFAULT_GUEST_CSV_KEYS
    )
    const [head, row] = csv.split('\n')
    expect(row.split('","').length).toBeGreaterThan(0)
    expect(row).toContain('"peanuts, dairy, shellfish"')
    // the quoted cell still leaves the row parseable as the same width
    expect(row.match(/(".*?"|[^,]*)(,|$)/g)?.length).toBe(head.split(',').length + 1)
  })
})

describe('guestCsvFilename', () => {
  const day = new Date('2026-07-25T18:00:00.000Z')

  it('names an unfiltered export plainly', () => {
    expect(guestCsvFilename(null, day)).toBe('wedding-guests-2026-07-25.csv')
  })

  // So a filtered export can't be mistaken for the full list weeks later.
  it('records the filter in the name', () => {
    expect(guestCsvFilename('no_response', day)).toBe('wedding-guests-no-response-2026-07-25.csv')
    expect(guestCsvFilename('attending', day)).toBe('wedding-guests-attending-2026-07-25.csv')
  })
})
