'use client'

import { useState, useEffect, useMemo } from 'react'
import { assertSeatCap, formatPartyName } from '@/lib/guests'
import { guestListStatus, formatAddedDate } from '@/lib/review'
import { formatMix, partySize, EMPTY_MIX, type MixTotals } from '@/lib/party-mix'
import {
  GUEST_CSV_COLUMNS,
  DEFAULT_GUEST_CSV_KEYS,
  buildGuestCsv,
  guestCsvFilename,
} from '@/lib/guest-csv'
import { MessageToSend } from '@/components/admin/MessageToSend'

const CSV_COLUMNS_STORAGE_KEY = 'wpw.guestCsvColumns'

// The grid's columns, in order. `narrow` ones are the counts: centred, tighter
// padding, and their headers allowed to wrap onto two lines, which is what buys the
// width for the three make-up columns.
//
// Kept as one list so the seating view's sub-header can derive its colSpan instead
// of carrying a hand-counted number that goes stale the moment a column is added.
const GUEST_COLUMNS: Array<{ label: string; narrow?: boolean }> = [
  { label: 'Name' },
  { label: 'Status' },
  { label: 'Table', narrow: true },
  { label: 'No. in Party', narrow: true },
  // The total, then the three columns that break it down, reading left to right —
  // Nicolle: "put No. RSVP'd next to No. in Party... then the three following
  // columns will break down the No. RSVP'd".
  { label: 'No. RSVP’d', narrow: true },
  { label: '21+', narrow: true },
  { label: 'Under 21', narrow: true },
  { label: 'Child', narrow: true },
  { label: 'Actions' },
]

const NUM_CELL = 'px-2 py-4 whitespace-nowrap text-sm text-center text-gray-900'

// The three buckets a party is made of, in the order they're shown. Driven off one
// list so the Edit popup can't end up offering a different set from the Add form.
const MIX_FIELDS = [
  { key: 'adults21Plus', id: 'edit-adults-21-plus', label: 'Adult(s) 21+' },
  { key: 'adultsUnder21', id: 'edit-adults-under-21', label: 'Adult(s) under 21' },
  { key: 'children', id: 'edit-children', label: 'Children' },
] as const

// A rendered row is either a guest or the table sub-header that introduces a group.
type GuestRow =
  // `key` is derived from the table number, not the label — a stable unique id for
  // React, so two groups can never collide and silently drop each other's rows.
  | { kind: 'table-header'; key: string; label: string; seats: number; parties: number }
  | { kind: 'guest'; guest: Guest }

interface Guest {
  id: string
  firstName: string
  lastName: string
  preferredName?: string | null
  email?: string | null
  phone?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  invitationCode?: string
  invitationSentAt?: string
  invitationOpenedAt?: string
  rsvpReceivedAt?: string
  attending?: boolean
  tableNumber?: number
  dietaryRestrictions?: string
  specialRequests?: string
  notes?: string
  partnerFirstName?: string
  partnerLastName?: string
  reservedSeats?: number | null
  rsvpdCount?: number | null
  adults21Plus?: number | null
  adultsUnder21?: number | null
  children?: number | null
  songRequest?: string
  source?: string | null
  reviewedAt?: string | null
  createdAt: string
  plusOnes?: Array<{
    id: string
    firstName: string
    lastName: string
    dietaryRestrictions?: string
    isChild: boolean
    age?: number
  }>
}

interface GuestStats {
  totalInvited: number
  rsvpReceived: number
  attending: number
  notAttending: number
  // The adults / children split under the two RSVP cards — the numbers the caterer
  // and the bar are quoted against. `unspecified` is the parties still to break out.
  attendingMix: MixTotals
  notAttendingMix: MixTotals
}

export default function GuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([])
  // NOTE: filteredGuests is derived below with useMemo, deliberately not state. As
  // state written by an effect it lagged one render behind sortBy — the render where
  // sortBy became "table" still held the name-ordered list, and the seating grouping
  // ran against it. Nicolle: "It needs to refresh when a new sort criteria is added."
  const [stats, setStats] = useState<GuestStats>({
    totalInvited: 0,
    rsvpReceived: 0,
    attending: 0,
    notAttending: 0,
    attendingMix: EMPTY_MIX,
    notAttendingMix: EMPTY_MIX,
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [showImport, setShowImport] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null)
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [showCsvColumns, setShowCsvColumns] = useState(false)
  const [csvColumns, setCsvColumns] = useState<string[]>(DEFAULT_GUEST_CSV_KEYS)

  const [newGuest, setNewGuest] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    addressLine1: '',
    city: '',
    state: '',
    zipCode: '',
    notes: '',
    partnerFirstName: '',
    partnerLastName: '',
    reservedSeats: '',
    adults21Plus: '',
    adultsUnder21: '',
    children: ''
  })

  useEffect(() => {
    fetchGuests()
  }, [])

  // Restore the saved column choice. Read once on mount rather than in useState, so
  // the server and first client render agree (localStorage doesn't exist on the
  // server). Anything unrecognised is dropped — column keys can be renamed later
  // without a stale selection producing a blank file.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CSV_COLUMNS_STORAGE_KEY)
      if (!saved) return
      const parsed: unknown = JSON.parse(saved)
      if (!Array.isArray(parsed)) return
      const known = parsed.filter((k): k is string =>
        typeof k === 'string' && GUEST_CSV_COLUMNS.some((c) => c.key === k)
      )
      if (known.length > 0) setCsvColumns(known)
    } catch {
      // Corrupt or unavailable storage just means the defaults stand.
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(CSV_COLUMNS_STORAGE_KEY, JSON.stringify(csvColumns))
    } catch {
      // Private browsing or a full quota — the choice just won't persist.
    }
  }, [csvColumns])

  const fetchGuests = async () => {
    try {
      const [guestsResponse, statsResponse] = await Promise.all([
        fetch('/api/admin/guests'),
        fetch('/api/admin/guests/stats')
      ])

      const guestsData = await guestsResponse.json()
      const statsData = await statsResponse.json()

      setGuests(guestsData.guests || [])
      // Default the two breakdowns rather than trusting the payload to carry them:
      // a cached or older response would otherwise blank the whole page on render.
      setStats({
        ...statsData,
        attendingMix: statsData.attendingMix ?? EMPTY_MIX,
        notAttendingMix: statsData.notAttendingMix ?? EMPTY_MIX,
      })
    } catch (error) {
      console.error('Failed to fetch guests:', error)
      setMessage('❌ Failed to load guest data')
    } finally {
      setIsLoading(false)
    }
  }

  // The running "Number in party" under the Add form's three fields. Blank stays
  // blank rather than becoming 0, so an untouched form shows no total at all.
  const numeric = (v: string) => (v === '' ? null : Number(v))
  const newGuestPartySize = partySize({
    adults21Plus: numeric(newGuest.adults21Plus),
    adultsUnder21: numeric(newGuest.adultsUnder21),
    children: numeric(newGuest.children),
  })

  const filteredGuests = useMemo(() => {
    const filtered = guests.filter(guest => {
      const matchesSearch = searchTerm === '' || 
        guest.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        guest.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (guest.email && guest.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (guest.partnerFirstName && guest.partnerFirstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (guest.partnerLastName && guest.partnerLastName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (guest.invitationCode && guest.invitationCode.toLowerCase().includes(searchTerm.toLowerCase()))

      // A guest has responded when we have an answer either way, no matter how it
      // arrived. rsvpReceivedAt is NOT the test: only the public form stamps it, so
      // keying off it hid every guest Nicolle answered for by editing the record —
      // and disagreed with the "RSVPs Received" stat card, which has always counted
      // attending true + false. These two must give the same number.
      const hasResponse = guest.attending === true || guest.attending === false

      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'responded' && hasResponse) ||
        (statusFilter === 'attending' && guest.attending === true) ||
        (statusFilter === 'not_attending' && guest.attending === false) ||
        (statusFilter === 'no_response' && !hasResponse)

      return matchesSearch && matchesStatus
    })

    // Sort guests
    const byName = (a: Guest, b: Guest) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rsvp': {
          // Newest response first, then everything without a date. Only the public
          // form stamps rsvpReceivedAt, so responses Nicolle entered herself have
          // none — they fall into the undated group and sort by name there rather
          // than in an arbitrary order. The old version returned 1 when *neither*
          // had a date, claiming a > b for two equal rows, which left the undated
          // tail shuffling around.
          const aTime = a.rsvpReceivedAt ? new Date(a.rsvpReceivedAt).getTime() : null
          const bTime = b.rsvpReceivedAt ? new Date(b.rsvpReceivedAt).getTime() : null
          if (aTime === null && bTime === null) return byName(a, b)
          if (aTime === null) return 1
          if (bTime === null) return -1
          return bTime - aTime || byName(a, b)
        }
        case 'table': {
          // Unassigned parties collect at the end — she's working through them, so
          // they belong together rather than salted between the seated tables.
          const at = a.tableNumber ?? null
          const bt = b.tableNumber ?? null
          if (at === null && bt === null) return byName(a, b)
          if (at === null) return 1
          if (bt === null) return -1
          return at - bt || byName(a, b)
        }
        case 'name':
        default:
          return byName(a, b)
      }
    })

    return filtered
  }, [guests, searchTerm, statusFilter, sortBy])

  const addGuest = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    try {
      const response = await fetch('/api/admin/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGuest)
      })

      if (response.ok) {
        setMessage('✅ Guest added successfully!')
        setNewGuest({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          addressLine1: '',
          city: '',
          state: '',
          zipCode: '',
          notes: '',
          partnerFirstName: '',
          partnerLastName: '',
          reservedSeats: '',
          adults21Plus: '',
          adultsUnder21: '',
          children: ''
        })
        setShowAddForm(false)
        fetchGuests()
      } else {
        const error = await response.json()
        setMessage(`❌ Error: ${error.error}`)
      }
    } catch (error) {
      setMessage('❌ Failed to add guest')
    }
  }

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setMessage('')
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/admin/guests/import', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (response.ok) {
        setMessage(`✅ Successfully imported ${result.imported} guests!`)
        fetchGuests()
        setShowImport(false)
      } else {
        setMessage(`❌ Import failed: ${result.error}`)
      }
    } catch (error) {
      setMessage('❌ Failed to import CSV file')
    }
  }

  // Built from filteredGuests — the exact array the table renders — so the file always
  // matches what's on screen: current search, status filter and sort order. Deriving
  // it again server-side would be a second definition of "what's on screen" to keep
  // in step, which is how the filters and the stat card drifted apart.
  const downloadCSV = () => {
    if (csvColumns.length === 0) return
    const csv = buildGuestCsv(filteredGuests, csvColumns)
    const scope = statusFilter === 'all' ? (searchTerm.trim() ? 'search' : null) : statusFilter
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = guestCsvFilename(scope, new Date())
    link.click()
    URL.revokeObjectURL(link.href)
    setShowCsvColumns(false)
    setMessage(`✅ Downloaded ${filteredGuests.length} guest${filteredGuests.length === 1 ? '' : 's'}`)
  }

  const toggleCsvColumn = (key: string) => {
    setCsvColumns((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
    )
  }

  const connectGoogleSheets = async () => {
    try {
      const response = await fetch('/api/admin/guests/google-sheets/auth')
      const data = await response.json()
      
      if (data.authUrl) {
        window.open(data.authUrl, '_blank')
        setMessage('✅ Google authorization opened in new tab')
      }
    } catch (error) {
      setMessage('❌ Failed to connect to Google Sheets')
    }
  }

  const startEditGuest = (guest: Guest) => {
    setEditingGuest(guest)
  }

  const saveEditGuest = async () => {
    if (!editingGuest) return

    try {
      const response = await fetch(`/api/admin/guests/${editingGuest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingGuest)
      })

      if (response.ok) {
        setMessage('✅ Guest updated successfully')
        fetchGuests()
        setEditingGuest(null)
      } else {
        const data = await response.json()
        setMessage(`❌ Failed to update guest: ${data.error}`)
      }
    } catch (error) {
      setMessage('❌ Failed to update guest')
    }
  }

  const deleteGuest = async (guestId: string, guestName: string) => {
    if (!confirm(`Are you sure you want to delete ${guestName}? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/guests/${guestId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setMessage('✅ Guest deleted successfully')
        fetchGuests()
      } else {
        const data = await response.json()
        setMessage(`❌ Failed to delete guest: ${data.error}`)
      }
    } catch (error) {
      setMessage('❌ Failed to delete guest')
    }
  }

  // Only surface the informative case: "Added <date>" for guests approved from the
  // To Review queue. Plain imported ("Matched") guests get no badge — it was on
  // every row and just cluttered the grid (Nicolle's call).
  const getListBadge = (guest: Guest) => {
    const s = guestListStatus({ source: guest.source ?? null, reviewedAt: guest.reviewedAt ?? null })
    if (s.kind === 'added') {
      return (
        <span className="inline-block mt-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs">
          Added {formatAddedDate(s.addedAt)}
        </span>
      )
    }
    return null
  }

  // Reads off `attending` alone, exactly like the status filter — so the badge and
  // the "No Response" filter can never disagree about the same guest. The old
  // "Response Received" and "Invited" badges keyed on rsvpReceivedAt and
  // invitationSentAt, which meant a guest with no answer could show something
  // other than "No Response" (Nicolle's ask: those two words, everywhere).
  // Sorting by table turns the list into a seating chart: each table announced once,
  // then its parties, then a gap (Nicolle: "a sub-header giving the table number
  // followed by the names with a bit of a space at the end"). Every other sort is a
  // plain list.
  //
  // Grouped into a Map rather than by walking adjacent rows. The walk assumed the
  // list arrived table-ordered, and when it didn't it emitted a header every time the
  // number changed — "Table 2" three times, groups of one, headers with no rows under
  // them. Worse, repeated labels meant repeated React keys, so React discarded the
  // sibling rows: that's why most parties vanished. A Map gives one entry per table by
  // construction, so neither can happen again whatever order the input is in.
  const guestRows = useMemo<GuestRow[]>(() => {
    if (sortBy !== 'table') return filteredGuests.map((guest) => ({ kind: 'guest' as const, guest }))

    const groups = new Map<number | null, Guest[]>()
    for (const guest of filteredGuests) {
      const table = guest.tableNumber ?? null
      const group = groups.get(table)
      if (group) group.push(guest)
      else groups.set(table, [guest])
    }

    const tables = Array.from(groups.keys()).sort((a, b) => {
      if (a === null) return 1 // unassigned collects at the end
      if (b === null) return -1
      return a - b
    })

    const rows: GuestRow[] = []
    for (const table of tables) {
      const group = groups.get(table)!
      rows.push({
        kind: 'table-header',
        key: table == null ? 'unassigned' : `t${table}`,
        label: table == null ? 'No table assigned yet' : `Table ${table}`,
        // Headcount actually coming, which is what she's balancing per table.
        seats: group.reduce((sum, g) => sum + (g.rsvpdCount ?? g.reservedSeats ?? 0), 0),
        parties: group.length,
      })
      for (const guest of group) rows.push({ kind: 'guest', guest })
    }
    return rows
  }, [filteredGuests, sortBy])

  const getStatusBadge = (guest: Guest) => {
    if (guest.attending === true) {
      return <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">✅ Attending</span>
    }
    if (guest.attending === false) {
      return <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">❌ Not Attending</span>
    }
    return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs">⏳ No Response</span>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading guests...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Guest Management</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowImport(!showImport)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            📤 Import CSV
          </button>
          {/* Opens the column picker rather than downloading straight away —
              Nicolle: "can it be opened up, perhaps as a popup window, when I click
              the Download CSV button?" One button instead of two, and the choice is
              in front of her at the moment she's about to use it. */}
          <button
            onClick={() => setShowCsvColumns(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
          >
            📥 Download CSV
          </button>
          <button
            onClick={connectGoogleSheets}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
          >
            📊 Google Sheets
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
          >
            ➕ Add Guest
          </button>
        </div>
      </div>

      {/* CSV column picker — a popup, opened by Download CSV. */}
      {showCsvColumns && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[85vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Download CSV</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {filteredGuests.length === guests.length
                      ? `All ${guests.length} parties.`
                      : `The ${filteredGuests.length} ${filteredGuests.length === 1 ? 'party' : 'parties'} currently shown, in the order shown.`}{' '}
                    Your column choice is remembered on this computer.
                  </p>
                </div>
                <button
                  onClick={() => setShowCsvColumns(false)}
                  aria-label="Close"
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-gray-100 pt-4">
                <h4 className="font-medium text-gray-900">
                  Columns ({csvColumns.length} of {GUEST_CSV_COLUMNS.length})
                </h4>
                <button
                  onClick={() => setCsvColumns(DEFAULT_GUEST_CSV_KEYS)}
                  className="text-sm text-[#00330a] underline"
                >
                  Reset to default
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                {GUEST_CSV_COLUMNS.map((column) => (
                  <label key={column.key} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={csvColumns.includes(column.key)}
                      onChange={() => toggleCsvColumn(column.key)}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-600"
                    />
                    {column.header}
                  </label>
                ))}
              </div>
              {csvColumns.length === 0 && (
                <p className="text-sm text-red-600">Pick at least one column to download.</p>
              )}

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button
                  onClick={downloadCSV}
                  disabled={csvColumns.length === 0}
                  className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  📥 Download
                </button>
                <button
                  onClick={() => setShowCsvColumns(false)}
                  className="bg-gray-200 text-gray-800 px-6 py-2 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-900">{stats.totalInvited}</div>
          <div className="text-blue-800 text-sm">Total Guests Invited</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-yellow-900">{stats.rsvpReceived}</div>
          <div className="text-yellow-800 text-sm">RSVPs Received</div>
        </div>
        {/* Broken down by adults and children, which is what the caterer and the bar
            need. "N to enter" is the parties whose make-up nobody has filled in yet —
            shown rather than folded into the adult count, so a number quoted off this
            card is a number that's actually been counted. */}
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-900">{stats.attending}</div>
          <div className="text-green-800 text-sm">Attending</div>
          {formatMix(stats.attendingMix) && (
            <div className="text-green-700 text-xs mt-1">{formatMix(stats.attendingMix)}</div>
          )}
        </div>
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-red-900">{stats.notAttending}</div>
          <div className="text-red-800 text-sm">Not Attending</div>
          {formatMix(stats.notAttendingMix) && (
            <div className="text-red-700 text-xs mt-1">{formatMix(stats.notAttendingMix)}</div>
          )}
        </div>
      </div>

      {/* CSV Import Section */}
      {showImport && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Import Guest List</h3>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVImport}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
            <p className="mt-2 text-sm text-gray-600">
              CSV should include columns: firstName, lastName, email, phone, addressLine1, city, state, zipCode
            </p>
          </div>
        </div>
      )}

      {/* Add Guest Form */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Add New Guest</h3>
          <form onSubmit={addGuest} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="First Name"
              value={newGuest.firstName}
              onChange={(e) => setNewGuest({...newGuest, firstName: e.target.value})}
              required
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            <input
              type="text"
              placeholder="Last Name"
              value={newGuest.lastName}
              onChange={(e) => setNewGuest({...newGuest, lastName: e.target.value})}
              required
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={newGuest.email}
              onChange={(e) => setNewGuest({...newGuest, email: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={newGuest.phone}
              onChange={(e) => setNewGuest({...newGuest, phone: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            <input
              type="text"
              placeholder="Address"
              value={newGuest.addressLine1}
              onChange={(e) => setNewGuest({...newGuest, addressLine1: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            <input
              type="text"
              placeholder="City"
              value={newGuest.city}
              onChange={(e) => setNewGuest({...newGuest, city: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            <input
              type="text"
              placeholder="State"
              value={newGuest.state}
              onChange={(e) => setNewGuest({...newGuest, state: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            <input
              type="text"
              placeholder="Zip Code"
              value={newGuest.zipCode}
              onChange={(e) => setNewGuest({...newGuest, zipCode: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            <input
              type="text"
              placeholder="Notes"
              value={newGuest.notes}
              onChange={(e) => setNewGuest({...newGuest, notes: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
            />

            {/* Second guest on the invite — the displayed party name combines
                automatically (formatPartyName): same last name → "Ann & Ben Blake";
                different last names → "Ann Blake & Cara Doe". */}
            <div className="md:col-span-2 lg:col-span-3 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700">Second guest on this invite (optional)</p>
              <p className="text-xs text-gray-500">
                Names combine automatically — same last name shows &ldquo;Ann &amp; Ben Blake&rdquo;; different last names show &ldquo;Ann Blake &amp; Cara Doe&rdquo;.
              </p>
            </div>
            <input
              type="text"
              placeholder="Partner First Name"
              value={newGuest.partnerFirstName}
              onChange={(e) => setNewGuest({...newGuest, partnerFirstName: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            <input
              type="text"
              placeholder="Partner Last Name (optional)"
              value={newGuest.partnerLastName}
              onChange={(e) => setNewGuest({...newGuest, partnerLastName: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
            />

            <div className="md:col-span-2 lg:col-span-3 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700">Places reserved for this invite</p>
              <p className="text-xs text-gray-500">How many seats you&rsquo;re holding for this party.</p>
            </div>
            <input
              type="number"
              min="0"
              placeholder="Number of places reserved"
              value={newGuest.reservedSeats}
              onChange={(e) => setNewGuest({...newGuest, reservedSeats: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
            />

            {/* Who's coming, split the way the caterer and the bar need it. Three
                buckets that don't overlap, so they add up to the number in the party
                — there is no separate figure to keep in step. The 21+ split is what
                the bar is quoted against: an adult under 21 eats an adult meal but
                drinks nothing. */}
            <div className="md:col-span-2 lg:col-span-3 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700">Who&rsquo;s in this party</p>
              <p className="text-xs text-gray-500">
                The number in the party is these added together. Adults under 21 are
                counted separately for the bar.
              </p>
            </div>
            <label className="text-sm text-gray-700">
              <span className="block mb-1">Adult(s) 21+</span>
              <input
                type="number"
                min="0"
                value={newGuest.adults21Plus}
                onChange={(e) => setNewGuest({...newGuest, adults21Plus: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </label>
            <label className="text-sm text-gray-700">
              <span className="block mb-1">Adult(s) under 21</span>
              <input
                type="number"
                min="0"
                value={newGuest.adultsUnder21}
                onChange={(e) => setNewGuest({...newGuest, adultsUnder21: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </label>
            <label className="text-sm text-gray-700">
              <span className="block mb-1">Children</span>
              <input
                type="number"
                min="0"
                value={newGuest.children}
                onChange={(e) => setNewGuest({...newGuest, children: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </label>
            <div className="md:col-span-2 lg:col-span-3 text-sm text-gray-600">
              {newGuestPartySize !== null && (
                <>Number in party: <strong>{newGuestPartySize}</strong></>
              )}
            </div>

            <div className="md:col-span-2 lg:col-span-3 flex space-x-3">
              <button
                type="submit"
                className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                Add Guest
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.startsWith('✅') 
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* Search and Filter Controls */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="Search by name, email, or invitation code"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
          
          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">Status Filter</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="all">All Guests</option>
              <option value="responded">RSVPs Received</option>
              <option value="attending">Attending</option>
              <option value="not_attending">Not Attending</option>
              <option value="no_response">No Response</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="sort-by" className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              {/* Email and Date Added dropped — Nicolle: "none of it means anything". */}
              <option value="name">Name</option>
              <option value="rsvp">RSVP Date</option>
              <option value="table">Table Number</option>
            </select>
          </div>
          
          {/* Only worth saying when a search or filter is narrowing the list — an
              unfiltered "Showing 66 of 66" is noise (Nicolle: "doesn't give info
              that I need").
              "parties", not "guests": a row is one invitation, and "Ethan & Amber
              Walters" is a single row holding four seats. The people count lives in
              the "Total Guests Invited" card, which sums reserved seats. */}
          <div className="flex items-end">
            {filteredGuests.length !== guests.length && (
              <div className="text-sm text-gray-600">
                Showing {filteredGuests.length} of {guests.length} parties
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Guest List Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Guest List</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            {/* Headers wrap onto two lines so the columns stay narrow — that's what
                made room for the make-up columns without pushing Actions off the
                edge. Nicolle: "make the columns narrower so that we can add ones for
                21+, Under 21 and Child... If you had the columns read 'No. in Party'
                it could wrap to two lines instead of one." */}
            <thead className="bg-gray-50">
              <tr>
                {GUEST_COLUMNS.map((c) => (
                  <th
                    key={c.label}
                    className={`py-3 text-xs font-medium text-gray-500 uppercase tracking-wider align-bottom ${
                      c.narrow
                        ? 'px-2 text-center w-px whitespace-normal'
                        : 'px-3 text-left max-w-[7rem]'
                    }`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {guestRows.map((row) =>
                row.kind === 'table-header' ? (
                  // Nicolle's seating view: each table announced once, with space
                  // before the next one, so the list reads as a seating chart.
                  <tr key={`table-${row.key}`} className="bg-green-50 border-t-8 border-gray-100">
                    <td colSpan={GUEST_COLUMNS.length} className="px-3 py-2 text-sm font-semibold text-[#00330a]">
                      {row.label}
                      <span className="ml-2 font-normal text-gray-600">
                        {row.seats} {row.seats === 1 ? 'person' : 'people'} · {row.parties} {row.parties === 1 ? 'party' : 'parties'}
                      </span>
                    </td>
                  </tr>
                ) : (
                  <tr key={row.guest.id} className="hover:bg-gray-50">
                    <td className="px-3 py-4">
                      <div className="text-sm font-medium text-gray-900">{formatPartyName(row.guest)}</div>
                      {getListBadge(row.guest)}
                      {row.guest.invitationCode && (
                        <div className="text-sm text-gray-500 font-mono">Code: {row.guest.invitationCode}</div>
                      )}
                    </td>
                    <td className="px-3 py-4">{getStatusBadge(row.guest)}</td>
                    <td className={NUM_CELL}>{row.guest.tableNumber ?? '—'}</td>
                    <td className={NUM_CELL}>{row.guest.reservedSeats ?? ''}</td>
                    <td className={NUM_CELL}>{row.guest.rsvpdCount ?? ''}</td>
                    {/* The three that break down No. RSVP'd on their left. Blank,
                        not 0, when a party hasn't been broken out yet — that empty
                        run of three IS Nicolle's "have I edited this record yet?"
                        signal, and a column of zeroes would erase it. */}
                    <td className={NUM_CELL}>{row.guest.adults21Plus ?? ''}</td>
                    <td className={NUM_CELL}>{row.guest.adultsUnder21 ?? ''}</td>
                    <td className={NUM_CELL}>{row.guest.children ?? ''}</td>
                    <td className="px-3 py-4 text-sm font-medium">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <button onClick={() => setSelectedGuest(row.guest)} className="text-blue-600 hover:text-blue-900">View</button>
                        <button className="text-green-600 hover:text-green-900" onClick={() => startEditGuest(row.guest)}>Edit</button>
                        <button className="text-red-600 hover:text-red-900" onClick={() => deleteGuest(row.guest.id, formatPartyName(row.guest))}>Delete</button>
                        <MessageToSend guestId={row.guest.id} email={row.guest.email ?? null} />
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
          
          {filteredGuests.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No guests found</p>
              <p className="text-sm">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria'
                  : 'Import a CSV file or add guests manually to get started'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Guest Detail Modal */}
      {selectedGuest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  {selectedGuest.firstName} {selectedGuest.lastName}
                </h3>
                <button
                  onClick={() => setSelectedGuest(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Email:</strong> {selectedGuest.email}
                </div>
                {selectedGuest.phone && (
                  <div>
                    <strong>Phone:</strong> {selectedGuest.phone}
                  </div>
                )}
                {selectedGuest.addressLine1 && (
                  <div className="md:col-span-2">
                    <strong>Address:</strong> {selectedGuest.addressLine1}
                    {selectedGuest.addressLine2 && `, ${selectedGuest.addressLine2}`}
                    {selectedGuest.city && `, ${selectedGuest.city}`}
                    {selectedGuest.state && ` ${selectedGuest.state}`}
                    {selectedGuest.zipCode && ` ${selectedGuest.zipCode}`}
                  </div>
                )}
                {selectedGuest.invitationCode && (
                  <div>
                    <strong>Invitation Code:</strong> {selectedGuest.invitationCode}
                  </div>
                )}
                {selectedGuest.invitationSentAt && (
                  <div>
                    <strong>Invited:</strong> {new Date(selectedGuest.invitationSentAt).toLocaleDateString()}
                  </div>
                )}
                {selectedGuest.rsvpReceivedAt && (
                  <div>
                    <strong>RSVP Received:</strong> {new Date(selectedGuest.rsvpReceivedAt).toLocaleDateString()}
                  </div>
                )}
                {selectedGuest.attending !== null && selectedGuest.attending !== undefined && (
                  <div>
                    <strong>Attending:</strong> {selectedGuest.attending ? 'Yes' : 'No'}
                  </div>
                )}
                {/* Shown even when unset — while she's seating people, "not yet" is
                    the answer she's looking for as often as a number. */}
                <div>
                  <strong>Table:</strong> {selectedGuest.tableNumber ?? 'Not assigned yet'}
                </div>
                {/* Labelled "Favorite Song" to match the Edit modal and the CSV —
                    the field is songRequest under the hood. */}
                {selectedGuest.songRequest && (
                  <div className="md:col-span-2">
                    <strong>Favorite Song:</strong> {selectedGuest.songRequest}
                  </div>
                )}
                {selectedGuest.dietaryRestrictions && (
                  <div className="md:col-span-2">
                    <strong>Dietary Restrictions:</strong> {selectedGuest.dietaryRestrictions}
                  </div>
                )}
                {selectedGuest.specialRequests && (
                  <div className="md:col-span-2">
                    <strong>Special Requests:</strong> {selectedGuest.specialRequests}
                  </div>
                )}
                {selectedGuest.notes && (
                  <div className="md:col-span-2">
                    <strong>Notes:</strong> {selectedGuest.notes}
                  </div>
                )}
              </div>
              
              {selectedGuest.plusOnes && selectedGuest.plusOnes.length > 0 && (
                <div className="mt-4">
                  <strong>Plus Ones:</strong>
                  <ul className="mt-2 space-y-1">
                    {selectedGuest.plusOnes.map((plusOne) => (
                      <li key={plusOne.id} className="text-sm bg-gray-50 p-2 rounded">
                        {plusOne.firstName} {plusOne.lastName}
                        {plusOne.isChild && ` (Child, age ${plusOne.age || 'not specified'})`}
                        {plusOne.dietaryRestrictions && ` - Dietary: ${plusOne.dietaryRestrictions}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Guest Modal */}
      {editingGuest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  Edit Guest: {editingGuest.firstName} {editingGuest.lastName}
                </h3>
                <button
                  onClick={() => setEditingGuest(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={(e) => { e.preventDefault(); saveEditGuest(); }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={editingGuest.firstName}
                    onChange={(e) => setEditingGuest({...editingGuest, firstName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={editingGuest.lastName}
                    onChange={(e) => setEditingGuest({...editingGuest, lastName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={editingGuest.email}
                    onChange={(e) => setEditingGuest({...editingGuest, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Partner First Name</label>
                  <input
                    type="text"
                    value={editingGuest.partnerFirstName || ''}
                    onChange={(e) => setEditingGuest({...editingGuest, partnerFirstName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Partner Last Name</label>
                  <input
                    type="text"
                    value={editingGuest.partnerLastName || ''}
                    onChange={(e) => setEditingGuest({...editingGuest, partnerLastName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                {/* Sits to the right of the two partner fields by Nicolle's request —
                    it finishes the second row instead of leading it. */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Name (emails)</label>
                  <input
                    type="text"
                    value={editingGuest.preferredName ?? ''}
                    onChange={(e) => setEditingGuest({...editingGuest, preferredName: e.target.value})}
                    placeholder="e.g. Grandma — blank uses their first name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editingGuest.phone || ''}
                    onChange={(e) => setEditingGuest({...editingGuest, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={editingGuest.addressLine1 || ''}
                    onChange={(e) => setEditingGuest({...editingGuest, addressLine1: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={editingGuest.city || ''}
                    onChange={(e) => setEditingGuest({...editingGuest, city: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={editingGuest.state || ''}
                    onChange={(e) => setEditingGuest({...editingGuest, state: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zip Code</label>
                  <input
                    type="text"
                    value={editingGuest.zipCode || ''}
                    onChange={(e) => setEditingGuest({...editingGuest, zipCode: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Table Number</label>
                  <input
                    type="number"
                    value={editingGuest.tableNumber || ''}
                    onChange={(e) => setEditingGuest({...editingGuest, tableNumber: e.target.value ? parseInt(e.target.value) : null})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Attending</label>
                  <select
                    value={editingGuest.attending === null ? 'null' : editingGuest.attending.toString()}
                    onChange={(e) => setEditingGuest({...editingGuest, attending: e.target.value === 'null' ? null : e.target.value === 'true'})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  >
                    <option value="null">No Response</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reserved Seats (number in party)</label>
                  <input
                    type="number"
                    min={0}
                    value={editingGuest.reservedSeats ?? ''}
                    onChange={(e) => setEditingGuest({...editingGuest, reservedSeats: e.target.value ? parseInt(e.target.value) : null})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
                {/* The party's make-up, so Number RSVP'd follows from it rather than
                    being typed again. That field stays editable only while nothing
                    here has been entered, which is how every record imported before
                    these fields existed keeps the count it already had. Adults under
                    21 are their own bucket because the bar can't be quoted off a
                    number that includes them. */}
                {MIX_FIELDS.map(({ key, id, label }) => (
                  <div key={key}>
                    <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                    <input
                      id={id}
                      type="number"
                      min={0}
                      value={editingGuest[key] ?? ''}
                      onChange={(e) => {
                        const next = { ...editingGuest, [key]: e.target.value ? parseInt(e.target.value) : null }
                        setEditingGuest({ ...next, rsvpdCount: partySize(next) ?? next.rsvpdCount })
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                ))}
                <div>
                  <label htmlFor="edit-rsvpd-count" className="block text-sm font-medium text-gray-700 mb-1">Number RSVP&apos;d</label>
                  <input
                    id="edit-rsvpd-count"
                    type="number"
                    min={0}
                    disabled={partySize(editingGuest) !== null}
                    value={editingGuest.rsvpdCount ?? ''}
                    onChange={(e) => setEditingGuest({...editingGuest, rsvpdCount: e.target.value ? parseInt(e.target.value) : null})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100 disabled:text-gray-600"
                  />
                  {partySize(editingGuest) !== null && (
                    <p className="text-xs text-gray-500 mt-1">Everyone in the party added together.</p>
                  )}
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Favorite Song</label>
                  <input
                    type="text"
                    value={editingGuest.songRequest || ''}
                    onChange={(e) => setEditingGuest({...editingGuest, songRequest: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dietary Restrictions</label>
                  <input
                    type="text"
                    value={editingGuest.dietaryRestrictions || ''}
                    onChange={(e) => setEditingGuest({...editingGuest, dietaryRestrictions: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                {assertSeatCap({ reservedSeats: editingGuest.reservedSeats, rsvpdCount: editingGuest.rsvpdCount }).ok === false && (
                  <div className="md:col-span-2 lg:col-span-3 text-sm text-red-700">
                    {(assertSeatCap({ reservedSeats: editingGuest.reservedSeats, rsvpdCount: editingGuest.rsvpdCount }) as { message: string }).message}
                  </div>
                )}

                <div className="md:col-span-2 lg:col-span-3 flex space-x-3 pt-4">
                  <button
                    type="submit"
                    disabled={!assertSeatCap({ reservedSeats: editingGuest.reservedSeats, rsvpdCount: editingGuest.rsvpdCount }).ok}
                    className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingGuest(null)}
                    className="bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}