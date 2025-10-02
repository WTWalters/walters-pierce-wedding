'use client'

import { useState } from 'react'

interface EmailStats {
  totalSent: number
  delivered: number
  opened: number
  failed: number
}

export default function EmailManagementPage() {
  const [stats, setStats] = useState<EmailStats>({
    totalSent: 0,
    delivered: 0,
    opened: 0,
    failed: 0
  })
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  const sendSaveTheDates = async () => {
    if (!confirm('Are you sure you want to send Save-the-Dates to all guests? This action cannot be undone.')) {
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/admin/email/save-the-dates', {
        method: 'POST'
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`✅ Save-the-Dates sent successfully to ${data.sent} guests!`)
        // Refresh stats
        fetchStats()
      } else {
        setMessage(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      setMessage('❌ Failed to send Save-the-Dates')
    } finally {
      setIsLoading(false)
    }
  }

  const sendTestEmail = async () => {
    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/admin/email/test', {
        method: 'POST'
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('✅ Test email sent successfully!')
      } else {
        setMessage(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      setMessage('❌ Failed to send test email')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/email/stats')
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Failed to fetch email stats:', error)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Email Management</h1>

      {/* Email Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <div className="text-blue-800 text-sm font-medium">Total Sent</div>
          <div className="text-2xl font-bold text-blue-900">{stats.totalSent}</div>
        </div>
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
          <div className="text-green-800 text-sm font-medium">Delivered</div>
          <div className="text-2xl font-bold text-green-900">{stats.delivered}</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
          <div className="text-purple-800 text-sm font-medium">Opened</div>
          <div className="text-2xl font-bold text-purple-900">{stats.opened}</div>
        </div>
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <div className="text-red-800 text-sm font-medium">Failed</div>
          <div className="text-2xl font-bold text-red-900">{stats.failed}</div>
        </div>
      </div>

      {/* Email Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Email Campaigns</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h3 className="font-medium">Send Save-the-Dates</h3>
              <p className="text-sm text-gray-600">
                Send save-the-date emails to all guests with invitation codes
              </p>
            </div>
            <button
              onClick={sendSaveTheDates}
              disabled={isLoading}
              className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Sending...' : 'Send Save-the-Dates'}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h3 className="font-medium">Test Email</h3>
              <p className="text-sm text-gray-600">
                Send a test email to verify your email configuration
              </p>
            </div>
            <button
              onClick={sendTestEmail}
              disabled={isLoading}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Sending...' : 'Send Test'}
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

      {/* Email Configuration */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Email Configuration</h2>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="font-medium">Service Provider</span>
            <span className="text-gray-600">Resend</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="font-medium">From Email</span>
            <span className="text-gray-600">noreply@walters-pierce-wedding.com</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="font-medium">API Status</span>
            <span className={`px-2 py-1 rounded-full text-xs ${
              process.env.RESEND_API_KEY?.startsWith('re_') 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {process.env.RESEND_API_KEY?.startsWith('re_') ? 'Configured' : 'Development Mode'}
            </span>
          </div>
        </div>

        {!process.env.RESEND_API_KEY?.startsWith('re_') && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-800">Development Mode</h4>
            <p className="text-sm text-yellow-700 mt-1">
              Emails will be logged to console instead of being sent. Configure RESEND_API_KEY in your environment variables to enable real email sending.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}