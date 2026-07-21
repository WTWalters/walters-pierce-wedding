'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'

export default function AdminDashboard() {
  const { data: session } = useSession()

  const adminActions = [
    {
      title: 'Guest Management',
      description: 'Manage the guest list, record RSVPs, and track attendance',
      href: '/admin/guests',
      icon: '👥',
      color: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      title: 'Photo Gallery',
      description: 'Manage wedding photos and guest uploads',
      href: '/admin/photos',
      icon: '📸',
      color: 'bg-pink-600 hover:bg-pink-700'
    },
    {
      title: 'Registry & Gifts',
      description: 'Honeymoon fund and gift registry',
      href: '/admin/registry',
      icon: '🎁',
      color: 'bg-yellow-600 hover:bg-yellow-700'
    }
  ]

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-green-600 to-green-800 rounded-lg p-6 text-white">
        <h2 className="text-3xl font-bold mb-2">Welcome to your Wedding Dashboard</h2>
        <p className="text-green-100">
          Manage all aspects of Emme & Connor's wedding planning in one place.
        </p>
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
        <div className="mt-6 text-sm">
          <Link href="/admin/users" className="text-gray-500 hover:text-gray-700 underline">Manage admin users</Link>
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