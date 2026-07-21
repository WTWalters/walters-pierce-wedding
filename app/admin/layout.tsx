'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const NAV_LINKS = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Guest Management', href: '/admin/guests' },
  { label: 'To Review', href: '/admin/review' },
  { label: 'Emails', href: '/admin/emails' },
  { label: 'Gifts', href: '/admin/registry' },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  const [reviewCount, setReviewCount] = useState(0)
  useEffect(() => {
    if (status !== 'authenticated' || session?.user.role !== 'admin') return
    fetch('/api/admin/review')
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => setReviewCount(d.count ?? 0))
      .catch(() => setReviewCount(0))
  }, [status, session, pathname]) // re-fetch on route change so it updates after actions

  useEffect(() => {
    if (status === 'loading') return // Still loading
    
    if (!session) {
      router.push('/auth/login')
      return
    }
    
    if (session.user.role !== 'admin') {
      router.push('/auth/login')
      return
    }
  }, [session, status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session || session.user.role !== 'admin') {
    return null // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/admin" className="group" aria-label="Go to admin dashboard">
              <h1 className="text-2xl font-bold text-green-900 font-serif group-hover:text-green-700 transition-colors">
                Wedding Admin
              </h1>
              <p className="text-sm text-gray-600">Walters-Pierce Wedding</p>
            </Link>

            <div className="flex items-center space-x-4">
              <span className="hidden sm:inline text-sm text-gray-700">
                Welcome, {session.user.email}
              </span>
              <button
                onClick={async () => {
                  await signOut({ redirect: false })
                  router.push('/auth/login')
                }}
                className="bg-green-800 text-white px-4 py-2 rounded-md text-sm hover:bg-green-900 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Primary navigation */}
          <nav className="flex items-center gap-1 -mb-px" aria-label="Admin sections">
            {NAV_LINKS.map((link) => {
              const isActive =
                link.href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-green-800 text-green-900'
                      : 'border-transparent text-gray-600 hover:text-green-800 hover:border-green-300'
                  }`}
                >
                  {link.label}
                  {link.href === '/admin/review' && reviewCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center rounded-full bg-amber-600 text-white text-xs px-2 py-0.5">
                      {reviewCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}