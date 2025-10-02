'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface DashboardStats {
  totalGuests: number
  rsvpResponses: number
  attending: number
  notAttending: number
}

export default function AdminDashboard() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<DashboardStats>({
    totalGuests: 0,
    rsvpResponses: 0,
    attending: 0,
    notAttending: 0
  })

  useEffect(() => {
    // Fetch dashboard stats
    fetch('/api/admin/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error('Failed to fetch stats:', err))
  }, [])

  const dashboardCards = [
    {
      title: 'Total Guests',
      value: stats.totalGuests,
      icon: '👥',
      color: 'bg-blue-50 border-blue-200',
      textColor: 'text-blue-800'
    },
    {
      title: 'RSVP Responses',
      value: stats.rsvpResponses,
      icon: '📝',
      color: 'bg-green-50 border-green-200',
      textColor: 'text-green-800'
    },
    {
      title: 'Attending',
      value: stats.attending,
      icon: '✅',
      color: 'bg-emerald-50 border-emerald-200',
      textColor: 'text-emerald-800'
    },
    {
      title: 'Not Attending',
      value: stats.notAttending,
      icon: '❌',
      color: 'bg-red-50 border-red-200',
      textColor: 'text-red-800'
    }
  ]

  const adminActions = [
    {
      title: 'Guest Management',
      description: 'Import guest list, manage RSVPs, and track attendance',
      href: '/admin/guests',
      icon: '👥',
      color: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      title: 'To-Do List',
      description: 'Track wedding planning tasks and deadlines',
      href: '/admin/todos',
      icon: '📋',
      color: 'bg-green-600 hover:bg-green-700'
    },
    {
      title: 'Venue & Events',
      description: 'Manage venue information and event timeline',
      href: '/admin/venues',
      icon: '🏛️',
      color: 'bg-purple-600 hover:bg-purple-700'
    },
    {
      title: 'Photo Gallery',
      description: 'Manage wedding photos and guest uploads',
      href: '/admin/photos',
      icon: '📸',
      color: 'bg-pink-600 hover:bg-pink-700'
    },
    {
      title: 'Wedding Party',
      description: 'Manage bridesmaids, groomsmen, and wedding party',
      href: '/admin/wedding-party',
      icon: '👰🤵',
      color: 'bg-rose-600 hover:bg-rose-700'
    },
    {
      title: 'Registry & Gifts',
      description: 'Manage honeymoon fund and gift registry',
      href: '/admin/registry',
      icon: '🎁',
      color: 'bg-yellow-600 hover:bg-yellow-700'
    },
    {
      title: 'Email Management',
      description: 'Send save-the-dates and manage email campaigns',
      href: '/admin/email',
      icon: '📧',
      color: 'bg-indigo-600 hover:bg-indigo-700'
    },
    {
      title: 'Save-the-Date Campaign',
      description: 'Manage and send save-the-date emails to guests',
      href: '/admin/save-the-date',
      icon: '📅',
      color: 'bg-orange-600 hover:bg-orange-700'
    },
    {
      title: 'Settings',
      description: 'Configure website settings and preferences',
      href: '/admin/settings',
      icon: '⚙️',
      color: 'bg-gray-600 hover:bg-gray-700'
    }
  ]

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-green-600 to-green-800 rounded-lg p-6 text-white">
        <h2 className="text-3xl font-bold mb-2">Welcome to your Wedding Dashboard</h2>
        <p className="text-green-100">
          Manage all aspects of Emme & CeeJay's wedding planning in one place.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardCards.map((card, index) => (
          <div key={index} className={`p-6 rounded-lg border-2 ${card.color}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${card.textColor} opacity-80`}>
                  {card.title}
                </p>
                <p className={`text-3xl font-bold ${card.textColor}`}>
                  {card.value}
                </p>
              </div>
              <div className="text-3xl opacity-60">
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminActions.map((action, index) => (
            <Link
              key={index}
              href={action.href}
              className={`block p-6 rounded-lg text-white transition-colors ${action.color}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold">{action.title}</h4>
                <span className="text-2xl opacity-80">{action.icon}</span>
              </div>
              <p className="text-sm opacity-90">{action.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-gray-700">System initialized</span>
            <span className="text-sm text-gray-500">Just now</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-gray-700">Admin users created</span>
            <span className="text-sm text-gray-500">Just now</span>
          </div>
          <div className="text-center py-4 text-gray-500">
            <p>More activity will appear here as you use the system</p>
          </div>
        </div>
      </div>
    </div>
  )
}