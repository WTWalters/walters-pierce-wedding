// One definition of the guest CSV: which columns exist, what they're called, and
// how each cell is rendered. The Download CSV button builds the file from the same
// filtered+sorted array the grid renders, so the download always matches the screen.

export type GuestCsvRow = {
  firstName?: string | null
  lastName?: string | null
  preferredName?: string | null
  email?: string | null
  partnerFirstName?: string | null
  partnerLastName?: string | null
  phone?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  country?: string | null
  rsvpReceivedAt?: string | Date | null
  attending?: boolean | null
  reservedSeats?: number | null
  rsvpdCount?: number | null
  adults?: number | null
  children?: number | null
  dietaryRestrictions?: string | null
  songRequest?: string | null
  specialRequests?: string | null
  notes?: string | null
  tableNumber?: number | null
  createdAt?: string | Date | null
}

export type GuestCsvColumn = {
  key: string
  header: string
  /** In the default download. Unchecked columns are opt-in via the picker. */
  isDefault: boolean
  value: (guest: GuestCsvRow) => string
}

const text = (v: string | null | undefined) => v ?? ''
const num = (v: number | null | undefined) => (v == null ? '' : String(v))
const date = (v: string | Date | null | undefined) =>
  v ? new Date(v).toLocaleDateString() : ''

// Order here is the order in the file. It stays fixed no matter what the picker
// selects — Excel reorders columns trivially, so a drag-to-reorder UI would be
// effort spent duplicating a spreadsheet feature.
export const GUEST_CSV_COLUMNS: GuestCsvColumn[] = [
  { key: 'firstName', header: 'First Name', isDefault: true, value: (g) => text(g.firstName) },
  { key: 'lastName', header: 'Last Name', isDefault: true, value: (g) => text(g.lastName) },
  { key: 'email', header: 'Email', isDefault: true, value: (g) => text(g.email) },
  { key: 'partnerFirstName', header: 'Partner First Name', isDefault: true, value: (g) => text(g.partnerFirstName) },
  { key: 'partnerLastName', header: 'Partner Last Name', isDefault: true, value: (g) => text(g.partnerLastName) },
  { key: 'preferredName', header: 'Preferred Name', isDefault: true, value: (g) => text(g.preferredName) },
  { key: 'phone', header: 'Phone', isDefault: true, value: (g) => text(g.phone) },
  { key: 'addressLine1', header: 'Address Line 1', isDefault: true, value: (g) => text(g.addressLine1) },
  { key: 'addressLine2', header: 'Address Line 2', isDefault: true, value: (g) => text(g.addressLine2) },
  { key: 'city', header: 'City', isDefault: true, value: (g) => text(g.city) },
  { key: 'state', header: 'State', isDefault: true, value: (g) => text(g.state) },
  { key: 'zipCode', header: 'Zip Code', isDefault: true, value: (g) => text(g.zipCode) },
  { key: 'country', header: 'Country', isDefault: true, value: (g) => text(g.country) },
  { key: 'rsvpReceivedAt', header: 'RSVP Received', isDefault: true, value: (g) => date(g.rsvpReceivedAt) },
  { key: 'attending', header: 'Attending', isDefault: true, value: (g) => (g.attending == null ? '' : g.attending ? 'Yes' : 'No') },
  { key: 'dietaryRestrictions', header: 'Dietary Restrictions', isDefault: true, value: (g) => text(g.dietaryRestrictions) },
  { key: 'songRequest', header: 'Favorite Song', isDefault: true, value: (g) => text(g.songRequest) },
  { key: 'tableNumber', header: 'Table Number', isDefault: true, value: (g) => num(g.tableNumber) },
  { key: 'createdAt', header: 'Created Date', isDefault: true, value: (g) => date(g.createdAt) },

  // Available but off by default. The first two are genuinely useful for seating;
  // the last two are the empty fields Nicolle had removed — she can bring them back
  // herself if they ever hold anything, instead of asking.
  { key: 'reservedSeats', header: 'Reserved Seats', isDefault: false, value: (g) => num(g.reservedSeats) },
  { key: 'rsvpdCount', header: "Number RSVP'd", isDefault: false, value: (g) => num(g.rsvpdCount) },
  // What the caterer and the bar are actually quoted against, so they're worth
  // sending on. Opt-in like the other headcount columns.
  { key: 'adults', header: 'Adults', isDefault: false, value: (g) => num(g.adults) },
  { key: 'children', header: 'Children', isDefault: false, value: (g) => num(g.children) },
  { key: 'specialRequests', header: 'Special Requests', isDefault: false, value: (g) => text(g.specialRequests) },
  { key: 'notes', header: 'Notes', isDefault: false, value: (g) => text(g.notes) },
]

export const DEFAULT_GUEST_CSV_KEYS = GUEST_CSV_COLUMNS.filter((c) => c.isDefault).map((c) => c.key)

export function escapeCsv(value: string): string {
  if (!value) return ''
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Build the CSV text. Column order always follows GUEST_CSV_COLUMNS, so a stale or
 * shuffled selection can't produce a scrambled file, and unknown keys are ignored
 * rather than emitting a blank column.
 */
export function buildGuestCsv(guests: GuestCsvRow[], selectedKeys: string[]): string {
  const selected = new Set(selectedKeys)
  const columns = GUEST_CSV_COLUMNS.filter((c) => selected.has(c.key))
  const rows = [columns.map((c) => c.header).join(',')]
  for (const guest of guests) {
    rows.push(columns.map((c) => escapeCsv(c.value(guest))).join(','))
  }
  return rows.join('\n')
}

/** e.g. wedding-guests-no-response-2026-07-25.csv — the filter is in the name so a
 *  partial export can't be mistaken for the whole list later. */
export function guestCsvFilename(scope: string | null, today: Date): string {
  const stamp = today.toISOString().split('T')[0]
  const slug = scope ? `-${scope.replace(/_/g, '-')}` : ''
  return `wedding-guests${slug}-${stamp}.csv`
}
