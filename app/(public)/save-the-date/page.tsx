'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function SaveTheDatePage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    dietaryRestrictions: ''
  })
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Email validation regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

  // US phone number formatting
  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    const phoneNumber = value.replace(/\D/g, '')
    
    // Format as (XXX) XXX-XXXX
    if (phoneNumber.length === 0) return ''
    if (phoneNumber.length <= 3) return `(${phoneNumber}`
    if (phoneNumber.length <= 6) return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`
    if (phoneNumber.length <= 10) return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6)}`
    // If more than 10 digits, only use the first 10
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
  }

  // Validate phone number (must be 10 digits)
  const validatePhoneNumber = (phone: string): boolean => {
    const digits = phone.replace(/\D/g, '')
    return digits.length === 10
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Required fields
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }
    
    // Phone is optional but if provided, must be valid
    if (formData.phone && !validatePhoneNumber(formData.phone)) {
      newErrors.phone = 'Please enter a valid 10-digit US phone number'
    }

    // Zip code validation (if provided)
    if (formData.zipCode && !/^\d{5}(-\d{4})?$/.test(formData.zipCode)) {
      newErrors.zipCode = 'Please enter a valid ZIP code (e.g., 12345 or 12345-6789)'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    setErrors({})

    try {
      const response = await fetch('/api/save-the-date', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        setErrors({ submit: data.error || 'Failed to save your information' })
        setIsSubmitting(false)
        return
      }

      setIsSubmitted(true)
      setIsSubmitting(false)
    } catch (error) {
      console.error('Error submitting form:', error)
      setErrors({ submit: 'An unexpected error occurred. Please try again.' })
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' })
    }

    // Format phone number as user types
    if (name === 'phone') {
      setFormData({
        ...formData,
        [name]: formatPhoneNumber(value)
      })
    } else {
      setFormData({
        ...formData,
        [name]: value
      })
    }
  }

  const handleEmailBlur = () => {
    if (formData.email && !emailRegex.test(formData.email)) {
      setErrors({ ...errors, email: 'Please enter a valid email address' })
    }
  }

  const handlePhoneBlur = () => {
    if (formData.phone && !validatePhoneNumber(formData.phone)) {
      setErrors({ ...errors, phone: 'Please enter a valid 10-digit US phone number' })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-amber-50" style={{ position: 'relative', isolation: 'isolate', overflow: 'hidden' }}>
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-green-900 font-serif mb-2">
              Save the Date
            </h1>
            <p className="text-green-700 text-lg">
              Emme & CeeJay's Wedding
            </p>
            <div className="mt-4">
              <Link
                href="/"
                className="text-green-600 hover:text-green-800 underline"
              >
                ← Back to Wedding Website
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Announcement Card */}
        <section className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-green-800 to-green-900 text-white p-8 text-center">
            <h2 className="text-4xl font-bold mb-4">You're Invited!</h2>
          </div>

          <div className="p-8 text-center">
            <h3 className="text-3xl font-bold text-gray-900 mb-6">We're Getting Married!</h3>

            <p className="text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed mb-8">
              We're so excited to celebrate our special day with you in the beautiful
              Colorado mountains.
            </p>

            {/* Wedding Details */}
            <div className="bg-green-50 border-2 border-yellow-500 p-6 rounded-lg max-w-lg mx-auto mb-8 relative overflow-hidden" style={{ contain: 'layout', isolation: 'isolate' }}>
              <h4 className="text-2xl font-bold text-green-900 mb-4" style={{ writingMode: 'horizontal-tb' }}>Emme & CeeJay</h4>
              <div className="space-y-2">
                <p className="text-2xl text-yellow-600 font-bold" style={{ writingMode: 'horizontal-tb' }}>September 2026</p>
                <p className="text-lg text-gray-700" style={{ writingMode: 'horizontal-tb' }}>Colorado Mountains</p>
              </div>
            </div>

            <p className="text-lg text-gray-700 max-w-3xl mx-auto mb-4">
              Formal invitations with all the details will follow, but we wanted to give you
              plenty of notice to mark your calendars!
            </p>
          </div>
        </section>

        {/* Signup Form */}
        <section className="bg-white rounded-lg shadow-lg p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-2 text-center">
            Please share your information with us so we can send you an invitation
          </h3>
          <p className="text-sm text-gray-600 text-center mb-6">
            *Don't worry, this is just for our records so we have the right address - and we promise not to share
          </p>

          {isSubmitted ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">✅</div>
              <h4 className="text-2xl font-bold text-green-800 mb-2">Thank You!</h4>
              <p className="text-gray-700 mb-4">
                We've received your information and will keep you updated with wedding details.
              </p>
              <p className="text-sm text-gray-500">
                You'll receive an email confirmation shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6" aria-label="Save the date form">
              {/* Error message */}
              {errors.submit && (
                <div className="bg-red-50 text-red-700 p-4 rounded-md text-sm">
                  {errors.submit}
                </div>
              )}

              {/* Name Fields */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    required
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-green-500 focus:border-green-500 ${
                      errors.firstName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    required
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-green-500 focus:border-green-500 ${
                      errors.lastName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Email and Phone */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    onBlur={handleEmailBlur}
                    placeholder="john.doe@example.com"
                    className={`w-full px-3 py-2 border rounded-md focus:ring-green-500 focus:border-green-500 ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-600">{errors.email}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    We'll use this to match your save-the-date and RSVP
                  </p>
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    onBlur={handlePhoneBlur}
                    placeholder="(555) 555-5555"
                    className={`w-full px-3 py-2 border rounded-md focus:ring-green-500 focus:border-green-500 ${
                      errors.phone ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.phone && (
                    <p className="mt-1 text-xs text-red-600">{errors.phone}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    US phone number for wedding updates
                  </p>
                </div>
              </div>

              {/* Address */}
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="123 Main Street"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                />
              </div>

              {/* City, State, Zip */}
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="Denver"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                <div>
                  <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    placeholder="CO"
                    maxLength={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                <div>
                  <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700 mb-1">
                    Zip Code
                  </label>
                  <input
                    type="text"
                    id="zipCode"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleInputChange}
                    placeholder="80202"
                    className={`w-full px-3 py-2 border rounded-md focus:ring-green-500 focus:border-green-500 ${
                      errors.zipCode ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.zipCode && (
                    <p className="mt-1 text-xs text-red-600">{errors.zipCode}</p>
                  )}
                </div>
              </div>

              {/* Dietary Restrictions */}
              <div>
                <label htmlFor="dietaryRestrictions" className="block text-sm font-medium text-gray-700 mb-1">
                  Dietary Restrictions or Food Allergies
                </label>
                <textarea
                  id="dietaryRestrictions"
                  name="dietaryRestrictions"
                  rows={3}
                  value={formData.dietaryRestrictions}
                  onChange={handleInputChange}
                  placeholder="Please let us know about any dietary restrictions, food allergies, or special meal preferences..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                />
              </div>

              {/* Submit Button */}
              <div className="text-center pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-green-800 text-white px-8 py-3 rounded-full hover:bg-green-900 transition-colors font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isSubmitting ? 'Submitting...' : '💌 Submit'}
                </button>
              </div>

              {/* Privacy Note */}
              <p className="text-xs text-gray-500 text-center">
                * Required fields. We'll only use your information to send wedding updates and will never share it with third parties.
              </p>
            </form>
          )}
        </section>
      </main>
    </div>
  )
}
