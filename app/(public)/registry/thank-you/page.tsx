import Link from 'next/link'

export default function RegistryThankYouPage() {
  return (
    <div className="min-h-screen bg-[#FFFDF7] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-serif text-[#00330a] mb-4">Thank you!</h1>
        <p className="text-gray-700 mb-2">
          Your gift is on its way to Emme &amp; Connor — thank you for helping them celebrate their honeymoon in Ireland.
        </p>
        <p className="text-gray-500 text-sm mb-8">A receipt is headed to your inbox.</p>
        <Link href="/" className="inline-block bg-[#00330a] text-white px-6 py-2 rounded-md hover:bg-[#004d0f] transition-colors">
          Back to the wedding site
        </Link>
      </div>
    </div>
  )
}
