'use client'

import { useState, useEffect } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [attemptCount, setAttemptCount] = useState(0)
  const [isLocked, setIsLocked] = useState(false)
  const [lockoutTimeRemaining, setLockoutTimeRemaining] = useState(0)
  const router = useRouter()

  // Timer for lockout countdown
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isLocked && lockoutTimeRemaining > 0) {
      interval = setInterval(() => {
        setLockoutTimeRemaining(prev => {
          if (prev <= 1) {
            setIsLocked(false)
            setAttemptCount(0)
            setError('')
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isLocked, lockoutTimeRemaining])

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isLocked) {
      return
    }

    setError('')
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        const newAttemptCount = attemptCount + 1
        setAttemptCount(newAttemptCount)

        if (newAttemptCount >= 3) {
          setIsLocked(true)
          setLockoutTimeRemaining(1800) // 30 minutes
          setError(`Account locked due to too many failed attempts. Locked for 30 minutes.`)
        } else {
          const remaining = 3 - newAttemptCount
          setError(`Invalid credentials. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.`)
        }
      } else {
        // Reset attempt count on success
        setAttemptCount(0)

        // Check if user has admin role
        const session = await getSession()
        if (session?.user?.role === 'admin') {
          router.push('/admin')
        } else {
          setError('Access denied. Admin privileges required.')
        }
      }
    } catch (error) {
      setError('An error occurred during login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-amber-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-2xl font-bold">🔐</span>
            </div>
            <h1 className="text-3xl font-bold text-green-900 font-serif">
              Admin Access
            </h1>
            <p className="text-green-700 mt-2">
              Walters-Pierce Wedding
            </p>
          </div>

          {/* Lockout Notice */}
          {isLocked && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
              <div className="flex items-center">
                <span className="text-red-500 mr-2">🔒</span>
                <div>
                  <p className="font-semibold">Account Temporarily Locked</p>
                  <p className="text-sm">Time remaining: {formatTime(lockoutTimeRemaining)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                placeholder="Enter your password"
              />
            </div>

            {error && !isLocked && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                <div className="flex items-center">
                  <span className="text-red-500 mr-2">⚠️</span>
                  {error}
                </div>
              </div>
            )}

            {attemptCount > 0 && attemptCount < 3 && !isLocked && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
                <div className="flex items-center">
                  <span className="text-yellow-500 mr-2">⚠️</span>
                  <span className="text-sm">Warning: {attemptCount} of 3 attempts used</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || isLocked}
              className={`w-full py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors font-medium ${
                isLocked
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-green-800 text-white hover:bg-green-900 focus:ring-green-600 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Authenticating...
                </div>
              ) : isLocked ? (
                `Locked - ${formatTime(lockoutTimeRemaining)}`
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Secure Login
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                Auto-lockout Protection
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <Link
                href="/"
                className="text-green-600 hover:text-green-800 text-sm transition-colors"
              >
                Back to Wedding Website
              </Link>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Unauthorized access attempts are monitored and reported.
          </p>
        </div>
      </div>
    </div>
  )
}