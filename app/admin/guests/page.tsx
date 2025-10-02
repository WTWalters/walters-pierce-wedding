'use client'

import { useState, useEffect } from 'react'

interface Guest {
  id: string
  firstName: string
  lastName: string
  email: string
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
  total: number
  invited: number
  rsvpReceived: number
  attending: number
  notAttending: number
  noResponse: number
  plusOnes: number
}

export default function GuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([])
  const [filteredGuests, setFilteredGuests] = useState<Guest[]>([])
  const [stats, setStats] = useState<GuestStats>({
    total: 0,
    invited: 0,
    rsvpReceived: 0,
    attending: 0,
    notAttending: 0,
    noResponse: 0,
    plusOnes: 0
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

  const [newGuest, setNewGuest] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    addressLine1: '',
    city: '',
    state: '',
    zipCode: '',
    notes: ''
  })

  useEffect(() => {
    fetchGuests()
  }, [])

  useEffect(() => {
    filterAndSortGuests()
  }, [guests, searchTerm, statusFilter, sortBy])

  const fetchGuests = async () => {
    try {
      const [guestsResponse, statsResponse] = await Promise.all([
        fetch('/api/admin/guests'),
        fetch('/api/admin/guests/stats')
      ])

      const guestsData = await guestsResponse.json()
      const statsData = await statsResponse.json()

      setGuests(guestsData.guests || [])
      setStats(statsData)
    } catch (error) {
      console.error('Failed to fetch guests:', error)
      setMessage('❌ Failed to load guest data')
    } finally {
      setIsLoading(false)
    }
  }

  const filterAndSortGuests = () => {
    const filtered = guests.filter(guest => {
      const matchesSearch = searchTerm === '' || 
        guest.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        guest.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        guest.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (guest.invitationCode && guest.invitationCode.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'invited' && guest.invitationSentAt) ||
        (statusFilter === 'responded' && guest.rsvpReceivedAt) ||
        (statusFilter === 'attending' && guest.attending === true) ||
        (statusFilter === 'not_attending' && guest.attending === false) ||
        (statusFilter === 'no_response' && !guest.rsvpReceivedAt && guest.invitationSentAt)

      return matchesSearch && matchesStatus
    })

    // Sort guests
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
        case 'email':
          return a.email.localeCompare(b.email)
        case 'rsvp':
          if (a.rsvpReceivedAt && b.rsvpReceivedAt) {
            return new Date(b.rsvpReceivedAt).getTime() - new Date(a.rsvpReceivedAt).getTime()
          }
          return a.rsvpReceivedAt ? -1 : 1
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        default:
          return 0
      }
    })

    setFilteredGuests(filtered)
  }

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
          notes: ''
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

  const downloadCSV = () => {
    window.open('/api/admin/guests/export', '_blank')
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

  const getStatusBadge = (guest: Guest) => {
    if (guest.attending === true) {
      return <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">✅ Attending</span>
    } else if (guest.attending === false) {
      return <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">❌ Not Attending</span>
    } else if (guest.rsvpReceivedAt) {
      return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">📝 Response Received</span>
    } else if (guest.invitationSentAt) {
      return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">📧 Invited</span>
    } else {
      return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs">⏳ Pending</span>
    }
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
          <button
            onClick={downloadCSV}
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-900">{stats.total}</div>
          <div className="text-blue-800 text-sm">Total Guests</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-purple-900">{stats.invited}</div>
          <div className="text-purple-800 text-sm">Invited</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-yellow-900">{stats.rsvpReceived}</div>
          <div className="text-yellow-800 text-sm">RSVP Received</div>
        </div>
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-900">{stats.attending}</div>
          <div className="text-green-800 text-sm">Attending</div>
        </div>
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-red-900">{stats.notAttending}</div>
          <div className="text-red-800 text-sm">Not Attending</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-orange-900">{stats.plusOnes}</div>
          <div className="text-orange-800 text-sm">Plus Ones</div>
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
              placeholder="Email"
              value={newGuest.email}
              onChange={(e) => setNewGuest({...newGuest, email: e.target.value})}
              required
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Status Filter</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="all">All Guests</option>
              <option value="invited">Invited</option>
              <option value="responded">RSVP Received</option>
              <option value="attending">Attending</option>
              <option value="not_attending">Not Attending</option>
              <option value="no_response">No Response</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="rsvp">RSVP Date</option>
              <option value="created">Date Added</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <div className="text-sm text-gray-600">
              Showing {filteredGuests.length} of {guests.length} guests
            </div>
          </div>
        </div>
      </div>

      {/* Guest List Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold">Guest List</h3>
          <div className="text-sm text-gray-500">
            {filteredGuests.length} guest{filteredGuests.length !== 1 ? 's' : ''}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Guest
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  RSVP Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredGuests.map((guest) => (
                <tr key={guest.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {guest.firstName} {guest.lastName}
                      </div>
                      {guest.invitationCode && (
                        <div className="text-sm text-gray-500 font-mono">
                          Code: {guest.invitationCode}
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{guest.email}</div>
                    {guest.phone && (
                      <div className="text-sm text-gray-500">{guest.phone}</div>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(guest)}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {guest.rsvpReceivedAt && (
                      <div>
                        <div>RSVP: {new Date(guest.rsvpReceivedAt).toLocaleDateString()}</div>
                        {guest.plusOnes && guest.plusOnes.length > 0 && (
                          <div>Plus ones: {guest.plusOnes.length}</div>
                        )}
                        {guest.dietaryRestrictions && (
                          <div className="text-xs">Dietary: {guest.dietaryRestrictions}</div>
                        )}
                      </div>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => setSelectedGuest(guest)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      View
                    </button>
                    <button 
                      className="text-green-600 hover:text-green-900 mr-3"
                      onClick={() => startEditGuest(guest)}
                    >
                      Edit
                    </button>
                    <button 
                      className="text-red-600 hover:text-red-900"
                      onClick={() => deleteGuest(guest.id, `${guest.firstName} ${guest.lastName}`)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
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
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-96 overflow-y-auto">
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
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dietary Restrictions</label>
                  <input
                    type="text"
                    value={editingGuest.dietaryRestrictions || ''}
                    onChange={(e) => setEditingGuest({...editingGuest, dietaryRestrictions: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
                
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={editingGuest.notes || ''}
                    onChange={(e) => setEditingGuest({...editingGuest, notes: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
                
                <div className="md:col-span-2 lg:col-span-3 flex space-x-3 pt-4">
                  <button
                    type="submit"
                    className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors"
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