'use client'

import { useState, useEffect } from 'react'

interface WeddingPartyMember {
  id: string
  name: string
  role: string
  side: string
  bio?: string
  relationship?: string
  photoUrl?: string
  sortOrder: number
  isFeatured: boolean
}

export default function AdminWeddingPartyPage() {
  const [weddingParty, setWeddingParty] = useState<WeddingPartyMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingMember, setEditingMember] = useState<WeddingPartyMember | null>(null)
  const [message, setMessage] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    role: 'bridesmaid',
    side: 'bride',
    bio: '',
    relationship: '',
    photoUrl: '',
    sortOrder: 0,
    isFeatured: false
  })

  useEffect(() => {
    fetchWeddingParty()
  }, [])

  const fetchWeddingParty = async () => {
    try {
      const response = await fetch('/api/admin/wedding-party')
      const data = await response.json()
      setWeddingParty(data.weddingParty || [])
    } catch (error) {
      console.error('Failed to fetch wedding party:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      role: 'bridesmaid',
      side: 'bride',
      bio: '',
      relationship: '',
      photoUrl: '',
      sortOrder: 0,
      isFeatured: false
    })
    setEditingMember(null)
    setShowAddForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    try {
      const endpoint = editingMember 
        ? `/api/admin/wedding-party/${editingMember.id}`
        : '/api/admin/wedding-party'
      
      const method = editingMember ? 'PUT' : 'POST'

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setMessage(`✅ Wedding party member ${editingMember ? 'updated' : 'added'} successfully!`)
        fetchWeddingParty()
        resetForm()
      } else {
        const error = await response.json()
        setMessage(`❌ Error: ${error.error}`)
      }
    } catch (error) {
      setMessage('❌ Failed to save wedding party member')
    }
  }

  const handleEdit = (member: WeddingPartyMember) => {
    setFormData({
      name: member.name,
      role: member.role,
      side: member.side,
      bio: member.bio || '',
      relationship: member.relationship || '',
      photoUrl: member.photoUrl || '',
      sortOrder: member.sortOrder,
      isFeatured: member.isFeatured
    })
    setEditingMember(member)
    setShowAddForm(true)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name} from the wedding party?`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/wedding-party/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setMessage(`✅ ${name} removed from wedding party`)
        fetchWeddingParty()
      } else {
        setMessage('❌ Failed to delete wedding party member')
      }
    } catch (error) {
      setMessage('❌ Failed to delete wedding party member')
    }
  }

  const formatRole = (role: string) => {
    return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading wedding party...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Wedding Party Management</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
        >
          {showAddForm ? 'Cancel' : 'Add Member'}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingMember ? 'Edit Wedding Party Member' : 'Add Wedding Party Member'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                <input
                  type="text"
                  value={formData.relationship}
                  onChange={(e) => setFormData({...formData, relationship: e.target.value})}
                  placeholder="e.g., Best Friend, Sister, Brother"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Side</label>
                <select
                  value={formData.side}
                  onChange={(e) => setFormData({...formData, side: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  <option value="bride">Bride's Side</option>
                  <option value="groom">Groom's Side</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  <option value="maid_of_honor">Maid of Honor</option>
                  <option value="bridesmaid">Bridesmaid</option>
                  <option value="best_man">Best Man</option>
                  <option value="groomsman">Groomsman</option>
                  <option value="flower_girl">Flower Girl</option>
                  <option value="ring_bearer">Ring Bearer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({...formData, sortOrder: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Photo URL</label>
                <input
                  type="url"
                  value={formData.photoUrl}
                  onChange={(e) => setFormData({...formData, photoUrl: e.target.value})}
                  placeholder="https://example.com/photo.jpg"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                rows={3}
                placeholder="A brief description about this person..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isFeatured"
                checked={formData.isFeatured}
                onChange={(e) => setFormData({...formData, isFeatured: e.target.checked})}
                className="text-green-600 focus:ring-green-500"
              />
              <label htmlFor="isFeatured" className="ml-2 text-sm text-gray-700">
                Featured member (Maid of Honor, Best Man)
              </label>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                {editingMember ? 'Update Member' : 'Add Member'}
              </button>
              <button
                type="button"
                onClick={resetForm}
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

      {/* Wedding Party List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Wedding Party Members ({weddingParty.length})</h3>
        </div>
        
        <div className="divide-y divide-gray-200">
          {weddingParty.map((member) => (
            <div key={member.id} className="p-6 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                  {member.photoUrl ? (
                    <img 
                      src={member.photoUrl} 
                      alt={member.name}
                      className="w-16 h-16 rounded-full object-cover"
                      onError={(e) => e.currentTarget.style.display = 'none'}
                    />
                  ) : (
                    <span className="text-2xl text-gray-500">👤</span>
                  )}
                </div>
                
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="font-semibold text-gray-900">{member.name}</h4>
                    {member.isFeatured && (
                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                        ⭐ Featured
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {formatRole(member.role)} • {member.side === 'bride' ? "Bride's Side" : "Groom's Side"}
                  </p>
                  {member.relationship && (
                    <p className="text-sm text-gray-500 italic">{member.relationship}</p>
                  )}
                  {member.bio && (
                    <p className="text-sm text-gray-700 mt-1 max-w-2xl">{member.bio}</p>
                  )}
                </div>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(member)}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(member.id, member.name)}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          
          {weddingParty.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              <p>No wedding party members yet. Add the first member!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}