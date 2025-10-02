'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface PlusOne {
  firstName: string
  lastName: string
  dietaryRestrictions: string
  isChild: boolean
  age?: number
}

export default function RSVPPage() {
  const [step, setStep] = useState(1)
  const [invitationCode, setInvitationCode] = useState('')
  const [guestInfo, setGuestInfo] = useState<any>(null)
  const [attending, setAttending] = useState<boolean | null>(null)
  const [plusOnes, setPlusOnes] = useState<PlusOne[]>([])
  const [dietaryRestrictions, setDietaryRestrictions] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const lookupInvitation = async () => {
    if (!invitationCode.trim()) {
      setError('Please enter your invitation code')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/rsvp/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationCode: invitationCode.trim() })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Invalid invitation code')
        return
      }

      setGuestInfo(data.guest)
      setStep(2)
    } catch (error) {
      setError('Failed to lookup invitation. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const addPlusOne = () => {
    setPlusOnes([...plusOnes, {
      firstName: '',
      lastName: '',
      dietaryRestrictions: '',
      isChild: false
    }])
  }

  const updatePlusOne = (index: number, field: keyof PlusOne, value: any) => {
    const updated = [...plusOnes]
    updated[index] = { ...updated[index], [field]: value }
    setPlusOnes(updated)
  }

  const removePlusOne = (index: number) => {
    setPlusOnes(plusOnes.filter((_, i) => i !== index))
  }

  const submitRSVP = async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/rsvp/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: guestInfo.id,
          attending,
          dietaryRestrictions,
          specialRequests,
          plusOnes: attending ? plusOnes : []
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to submit RSVP')
        return
      }

      setStep(3) // Success step
    } catch (error) {
      setError('Failed to submit RSVP. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-amber-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-green-900 font-serif mb-2">
            RSVP
          </h1>
          <p className="text-green-700 text-lg">
            Emme & Connor's Wedding
          </p>
          <p className="text-gray-600 mt-2">
            September 2026 • Colorado
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Step 1: Invitation Code Lookup */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  Find Your Invitation
                </h2>
                <p className="text-gray-600">
                  Please enter the invitation code from your save-the-date or invitation
                </p>
              </div>

              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                  Invitation Code
                </label>
                <input
                  id="code"
                  type="text"
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value)}
                  placeholder="Enter your invitation code"
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent text-center text-lg font-mono"
                  onKeyPress={(e) => e.key === 'Enter' && lookupInvitation()}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                  {error}
                </div>
              )}

              <button
                onClick={lookupInvitation}
                disabled={isLoading}
                className="w-full bg-green-800 text-white py-3 px-6 rounded-md hover:bg-green-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg font-medium"
              >
                {isLoading ? 'Looking up...' : 'Find My Invitation'}
              </button>
            </div>
          )}

          {/* Step 2: RSVP Form */}
          {step === 2 && guestInfo && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  Hello, {guestInfo.firstName}!
                </h2>
                <p className="text-gray-600">
                  We're so excited to celebrate with you
                </p>
              </div>

              {/* Attendance Question */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Will you be attending our wedding?
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center p-4 border-2 border-gray-200 rounded-md cursor-pointer hover:bg-green-50 transition-colors">
                    <input
                      type="radio"
                      name="attending"
                      value="yes"
                      checked={attending === true}
                      onChange={() => setAttending(true)}
                      className="text-green-600 focus:ring-green-500"
                    />
                    <span className="ml-3 text-lg">✅ Yes, I'll be there!</span>
                  </label>
                  <label className="flex items-center p-4 border-2 border-gray-200 rounded-md cursor-pointer hover:bg-red-50 transition-colors">
                    <input
                      type="radio"
                      name="attending"
                      value="no"
                      checked={attending === false}
                      onChange={() => setAttending(false)}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span className="ml-3 text-lg">❌ Sorry, I can't make it</span>
                  </label>
                </div>
              </div>

              {/* Plus Ones (only if attending) */}
              {attending === true && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">Plus Ones</h3>
                    <button
                      onClick={addPlusOne}
                      className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-sm"
                    >
                      Add Guest
                    </button>
                  </div>

                  {plusOnes.map((plusOne, index) => (
                    <div key={index} className="p-4 border border-gray-200 rounded-md space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">Guest {index + 1}</h4>
                        <button
                          onClick={() => removePlusOne(index)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="First Name"
                          value={plusOne.firstName}
                          onChange={(e) => updatePlusOne(index, 'firstName', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                        />
                        <input
                          type="text"
                          placeholder="Last Name"
                          value={plusOne.lastName}
                          onChange={(e) => updatePlusOne(index, 'lastName', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                        />
                      </div>

                      <div className="flex items-center space-x-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={plusOne.isChild}
                            onChange={(e) => updatePlusOne(index, 'isChild', e.target.checked)}
                            className="text-green-600 focus:ring-green-500"
                          />
                          <span className="ml-2 text-sm">Child (under 12)</span>
                        </label>
                        {plusOne.isChild && (
                          <input
                            type="number"
                            placeholder="Age"
                            value={plusOne.age || ''}
                            onChange={(e) => updatePlusOne(index, 'age', parseInt(e.target.value) || undefined)}
                            className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                          />
                        )}
                      </div>

                      <input
                        type="text"
                        placeholder="Dietary restrictions (optional)"
                        value={plusOne.dietaryRestrictions}
                        onChange={(e) => updatePlusOne(index, 'dietaryRestrictions', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Dietary Restrictions */}
              {attending === true && (
                <div>
                  <label htmlFor="dietary" className="block text-sm font-medium text-gray-700 mb-2">
                    Your Dietary Restrictions (optional)
                  </label>
                  <input
                    id="dietary"
                    type="text"
                    value={dietaryRestrictions}
                    onChange={(e) => setDietaryRestrictions(e.target.value)}
                    placeholder="Vegetarian, vegan, allergies, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
              )}

              {/* Special Requests */}
              <div>
                <label htmlFor="requests" className="block text-sm font-medium text-gray-700 mb-2">
                  Special Requests or Notes (optional)
                </label>
                <textarea
                  id="requests"
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Any special accommodations or messages for the couple..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                  {error}
                </div>
              )}

              <div className="flex space-x-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-500 text-white py-3 px-6 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={submitRSVP}
                  disabled={isLoading || attending === null}
                  className="flex-1 bg-green-800 text-white py-3 px-6 rounded-md hover:bg-green-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Submitting...' : 'Submit RSVP'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="text-center space-y-6">
              <div className="text-6xl">🎉</div>
              <h2 className="text-2xl font-semibold text-gray-900">
                Thank You!
              </h2>
              <p className="text-gray-600 text-lg">
                Your RSVP has been submitted successfully.
              </p>
              {attending ? (
                <div className="space-y-4">
                  <p className="text-green-700 font-medium">
                    We can't wait to celebrate with you!
                  </p>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-800 font-medium mb-3">
                      🎊 You now have access to exclusive wedding details!
                    </p>
                    <Link
                      href="/wedding-details"
                      className="inline-block bg-green-700 text-white py-2 px-6 rounded-md hover:bg-green-800 transition-colors font-medium"
                    >
                      View Wedding Details
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-gray-700">
                  We'll miss you, but we understand. Thank you for letting us know.
                </p>
              )}
              <button
                onClick={() => router.push('/')}
                className="bg-gray-600 text-white py-3 px-6 rounded-md hover:bg-gray-700 transition-colors"
              >
                Return to Wedding Website
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}