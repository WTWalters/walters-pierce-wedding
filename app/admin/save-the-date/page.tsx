'use client'

import { useState, useEffect } from 'react'

interface SaveTheDateStats {
  totalGuests: number
  emailsSent: number
  emailsOpened: number
  pendingSend: number
}

export default function SaveTheDatePage() {
  const [stats, setStats] = useState<SaveTheDateStats>({
    totalGuests: 0,
    emailsSent: 0,
    emailsOpened: 0,
    pendingSend: 0
  })
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/save-the-date/stats')
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const sendSaveTheDates = async () => {
    if (!confirm(`Are you sure you want to send Save-the-Dates to ${stats.pendingSend} guests? This action cannot be undone.`)) {
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/admin/save-the-date/send', {
        method: 'POST'
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`✅ Save-the-Dates sent successfully to ${data.sent} guests!`)
        fetchStats() // Refresh stats
      } else {
        setMessage(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      setMessage('❌ Failed to send Save-the-Dates')
    } finally {
      setIsLoading(false)
    }
  }

  const sendTestSaveTheDate = async () => {
    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/admin/save-the-date/preview', {
        method: 'POST'
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('✅ Test Save-the-Date sent to your email!')
      } else {
        setMessage(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      setMessage('❌ Failed to send test Save-the-Date')
    } finally {
      setIsLoading(false)
    }
  }

  const generateInvitationCodes = async () => {
    if (!confirm('This will generate invitation codes for guests who don\'t have them. Continue?')) {
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/admin/save-the-date/generate-codes', {
        method: 'POST'
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`✅ Generated invitation codes for ${data.generated} guests!`)
        fetchStats()
      } else {
        setMessage(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      setMessage('❌ Failed to generate invitation codes')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Save-the-Date Campaign</h1>
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
        >
          {showPreview ? 'Hide Preview' : 'Preview Email'}
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <div className="text-blue-800 text-sm font-medium">Total Guests</div>
          <div className="text-2xl font-bold text-blue-900">{stats.totalGuests}</div>
        </div>
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
          <div className="text-green-800 text-sm font-medium">Emails Sent</div>
          <div className="text-2xl font-bold text-green-900">{stats.emailsSent}</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
          <div className="text-purple-800 text-sm font-medium">Emails Opened</div>
          <div className="text-2xl font-bold text-purple-900">{stats.emailsOpened}</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <div className="text-yellow-800 text-sm font-medium">Pending Send</div>
          <div className="text-2xl font-bold text-yellow-900">{stats.pendingSend}</div>
        </div>
      </div>

      {/* Email Preview */}
      {showPreview && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Save-the-Date Email Preview</h2>
          <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="bg-gradient-to-r from-green-800 to-green-900 text-white p-8 text-center rounded-lg mb-4">
              <h1 className="text-3xl font-bold mb-2">Save the Date</h1>
              <p className="text-lg opacity-90">You're Invited!</p>
            </div>
            
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">Dear [Guest Name],</h2>
              <p className="text-lg text-gray-700">We're getting married and we want you to be there!</p>
              
              <div className="bg-green-50 border-2 border-yellow-500 p-6 rounded-lg my-6">
                <h2 className="text-2xl font-bold text-green-900 mb-2">Emme & Connor</h2>
                <p className="text-xl text-yellow-600 font-bold">September 2026</p>
                <p className="text-lg text-gray-700">Colorado</p>
                <p className="text-sm text-gray-500 mt-2">Exact date and venue details coming soon!</p>
              </div>
              
              <div className="bg-white border-2 border-dashed border-yellow-500 p-4 rounded-lg">
                <p className="font-medium mb-2">Your Invitation Code:</p>
                <div className="font-mono text-lg font-bold tracking-wider">[INVITATION_CODE]</div>
              </div>
              
              <button className="bg-green-600 text-white px-6 py-3 rounded-md font-medium">
                Visit Our Wedding Website
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Campaign Management</h2>
        
        <div className="space-y-4">
          {/* Generate Invitation Codes */}
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h3 className="font-medium">Generate Invitation Codes</h3>
              <p className="text-sm text-gray-600">
                Create unique invitation codes for guests who don't have them yet
              </p>
            </div>
            <button
              onClick={generateInvitationCodes}
              disabled={isLoading}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Generating...' : 'Generate Codes'}
            </button>
          </div>

          {/* Send Test Save-the-Date */}
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h3 className="font-medium">Send Test Save-the-Date</h3>
              <p className="text-sm text-gray-600">
                Send a test save-the-date email to your admin email address
              </p>
            </div>
            <button
              onClick={sendTestSaveTheDate}
              disabled={isLoading}
              className="bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Sending...' : 'Send Test'}
            </button>
          </div>

          {/* Send Save-the-Dates */}
          <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
            <div>
              <h3 className="font-medium text-red-900">Send Save-the-Dates</h3>
              <p className="text-sm text-red-700">
                Send save-the-date emails to all guests who haven't received them yet ({stats.pendingSend} guests)
              </p>
            </div>
            <button
              onClick={sendSaveTheDates}
              disabled={isLoading || stats.pendingSend === 0}
              className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Sending...' : `Send to ${stats.pendingSend} Guests`}
            </button>
          </div>
        </div>
      </div>

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

      {/* Campaign Timeline */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Campaign Timeline</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              <div>
                <h4 className="font-medium">Save-the-Date Campaign</h4>
                <p className="text-sm text-gray-600">September 2025 (Target)</p>
              </div>
            </div>
            <span className="text-sm text-gray-500">
              {stats.emailsSent > 0 ? 'In Progress' : 'Pending'}
            </span>
          </div>
          
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-blue-300 rounded-full"></div>
              <div>
                <h4 className="font-medium">Formal Invitations</h4>
                <p className="text-sm text-gray-600">May 2026 (Target)</p>
              </div>
            </div>
            <span className="text-sm text-gray-500">Future</span>
          </div>
          
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-gray-300 rounded-full"></div>
              <div>
                <h4 className="font-medium">RSVP Reminders</h4>
                <p className="text-sm text-gray-600">July 2026 (Target)</p>
              </div>
            </div>
            <span className="text-sm text-gray-500">Future</span>
          </div>
        </div>
      </div>
    </div>
  )
}