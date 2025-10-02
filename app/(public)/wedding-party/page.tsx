'use client'

import Link from 'next/link'

interface WeddingPartyMember {
  id: string
  name: string
  role: string
  side: string
  bio: string
  relationship?: string
  photoUrl?: string
  sortOrder: number
  isFeatured: boolean
}

export default function WeddingPartyPage() {
  // Static wedding party data with bride's personal descriptions
  const bridesSide: WeddingPartyMember[] = [
    {
      id: '1',
      name: 'Riley Adams',
      role: 'Maid of Honor',
      side: 'bride',
      bio: "Riley has quickly and seamlessly become one of the most important people in my life. Over the past year, she's been nothing but loving, supportive, and the biggest cheerleader in my corner. My favorite memories are our spontaneous adventures—she's the kind of friend I can spend hours with and never run out of things to talk about. I couldn't imagine saying \"I do\" without her by my side.",
      photoUrl: '/images/wedding-party/Riley_Adams.jpeg',
      sortOrder: 1,
      isFeatured: true
    },
    {
      id: '2',
      name: 'L Walters',
      role: 'Bridesmaid',
      side: 'bride',
      bio: "L is my sister, but more importantly, my built-in best friend. We have endless stories of the shenanigans we pulled growing up. Both on each other and our parents! I couldn't imagine this day without my wonderful little sister by my side.",
      relationship: 'Sister',
      photoUrl: '/images/wedding-party/L_Walters.jpeg',
      sortOrder: 2,
      isFeatured: false
    },
    {
      id: '3',
      name: 'Gabi Cain',
      role: 'Bridesmaid',
      side: 'bride',
      bio: "Gabi and I have been friends for over 10 years, sharing every phase of life together. The ups, the downs, and everything in between. Her friendship has never wavered, and I'm so grateful she'll be by my side on my big day.",
      photoUrl: '/images/wedding-party/Gabi_Cain.jpeg',
      sortOrder: 3,
      isFeatured: false
    },
    {
      id: '4',
      name: 'Heather Gonzales',
      role: 'Bridesmaid',
      side: 'bride',
      bio: "Heather is not only my cousin but also someone I've looked up to for as long as I can remember. Over the last three years, we've grown even closer and she's become the voice of reason in my ear. I'm so grateful she's making the trip from New York to stand by my side as I say \"I do\"!",
      relationship: 'Cousin',
      photoUrl: '/images/wedding-party/Heather_Gonzales.jpeg',
      sortOrder: 4,
      isFeatured: false
    },
    {
      id: '5',
      name: 'Grayson Heyart',
      role: 'Bridesmaid',
      side: 'bride',
      bio: "Grayson and I first met as coworkers at Sweet Cow, and I never could have guessed that scooping ice cream would bring me one of my closest friends. She was a light for me during one of the toughest times in my life, and I'm so grateful she'll be by my side on such an important day.",
      relationship: 'Sweet Cow Coworker & Friend',
      photoUrl: '/images/wedding-party/Grayson_Heyart.jpeg',
      sortOrder: 5,
      isFeatured: false
    },
    {
      id: '6',
      name: 'Sophia Walters',
      role: 'Flower Girl',
      side: 'bride',
      bio: "Sophia is Emme's sweet niece who will be spreading flower petals down the aisle on the big day. She's the daughter of Emme's brother Ethan and sister-in-law Amber.",
      relationship: 'Niece (Ethan & Amber\'s daughter)',
      photoUrl: '/images/wedding-party/Sophia_Walters.jpeg',
      sortOrder: 6,
      isFeatured: false
    },
    {
      id: '7',
      name: 'Reagan Walters',
      role: 'Flower Girl',
      side: 'bride',
      bio: "Reagan is another one of Emme's precious nieces who will be joining Sophia as a flower girl. She's the daughter of Emme's brother Tom and sister-in-law Jennifer.",
      relationship: 'Niece (Tom & Jennifer\'s daughter)',
      photoUrl: '/images/wedding-party/Reagan_Walters.jpeg',
      sortOrder: 7,
      isFeatured: false
    },
    {
      id: '8',
      name: 'Daniel Walters',
      role: 'Ring Bearer',
      side: 'bride',
      bio: "Daniel is Emme's nephew who has the very important job of carrying the rings down the aisle. He's the son of Emme's brother Ethan and sister-in-law Amber, and Sophia's younger brother.",
      relationship: 'Nephew (Ethan & Amber\'s son, Sophia\'s brother)',
      photoUrl: '/images/wedding-party/Daniel_Walters.jpeg',
      sortOrder: 8,
      isFeatured: false
    }
  ]

  const groomsSide: WeddingPartyMember[] = [
    // Groom's side will be added when provided
  ]

  const formatRole = (role: string) => {
    return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const getRoleColor = (role: string) => {
    if (role === 'Maid of Honor' || role === 'Best Man') {
      return 'text-yellow-600 font-semibold'
    }
    if (role === 'Flower Girl') {
      return 'text-pink-600 font-semibold'
    }
    if (role === 'Ring Bearer') {
      return 'text-blue-600 font-semibold'
    }
    return 'text-green-700'
  }

  const WeddingPartyCard = ({ member }: { member: WeddingPartyMember }) => (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden transform hover:scale-105 transition-transform duration-300" style={{ minWidth: '300px' }}>
      <div className="relative h-64 bg-gradient-to-br from-green-50 to-amber-50">
        {member.photoUrl ? (
          <img
            src={member.photoUrl}
            alt={`${member.name} - ${member.role}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="w-24 h-24 bg-white rounded-full shadow-lg flex items-center justify-center">
              <span className="text-4xl">
                {member.role === 'Flower Girl' ? '🌸' :
                 member.role === 'Ring Bearer' ? '💍' : '👤'}
              </span>
            </div>
          </div>
        )}
        {member.isFeatured && (
          <div className="absolute top-2 right-2">
            <span className="bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-md">
              ⭐ Maid of Honor
            </span>
          </div>
        )}
      </div>
      
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-1" style={{ hyphens: 'none', wordBreak: 'keep-all' }}>{member.name}</h3>
        <p className={`text-sm mb-2 ${getRoleColor(member.role)}`} style={{ hyphens: 'none', wordBreak: 'keep-all' }}>
          {member.role}
        </p>
        
        {member.relationship && (
          <p className="text-sm text-gray-600 mb-3 italic" style={{ hyphens: 'none', wordBreak: 'normal' }}>
            {member.relationship}
          </p>
        )}
        
        <p className="text-gray-700 text-sm leading-relaxed" style={{ hyphens: 'none', wordBreak: 'normal' }}>
          {member.bio}
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-amber-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-green-900 font-serif mb-2">
              Wedding Party
            </h1>
            <p className="text-green-700 text-lg">
              The special people celebrating with Emme & CeeJay
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
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Introduction */}
        <div className="text-center mb-12">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4" style={{ hyphens: 'none', wordBreak: 'keep-all' }}>
              Our Wedding Party
            </h2>
            <p className="text-lg text-gray-700 max-w-4xl mx-auto leading-relaxed" style={{ hyphens: 'none', wordBreak: 'normal' }}>
              We're surrounded by the most amazing family and friends who have supported us 
              throughout our journey. These special people will be standing with us as we 
              exchange vows and celebrate this new chapter in our lives.
            </p>
          </div>
        </div>

        {/* Bride's Side */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">👰 Bride's Side</h2>
            <p className="text-gray-600">Supporting Emme on her special day</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {bridesSide.map((member) => (
              <WeddingPartyCard key={member.id} member={member} />
            ))}
          </div>
        </div>

        {/* Groom's Side */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">🤵 Groom's Side</h2>
            <p className="text-gray-600">Supporting CeeJay on his special day</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {groomsSide.map((member) => (
              <WeddingPartyCard key={member.id} member={member} />
            ))}
          </div>
          
          {groomsSide.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">Wedding party information coming soon!</p>
            </div>
          )}
        </div>

        {/* Thank You Section */}
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Thank You to Our Wedding Party
          </h3>
          <p className="text-lg text-gray-700 mb-6 max-w-3xl mx-auto">
            To our incredible wedding party - thank you for being such an important part of our lives 
            and for standing with us on our wedding day. Your love, support, and friendship mean the world to us.
          </p>
          <div className="text-4xl mb-4">💕</div>
          <p className="text-green-700 font-medium">
            We love you all!
          </p>
          <p className="text-lg text-gray-600 mt-4">
            Emme & CeeJay
          </p>
        </div>
      </div>
    </div>
  )
}