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
      photoUrl: '/images/wedding-party/L_Walters_new.jpg',
      sortOrder: 2,
      isFeatured: false
    },
    {
      id: '3',
      name: 'Gabi Cain',
      role: 'Bridesmaid',
      side: 'bride',
      bio: "Gabi and I have been friends for over 10 years, sharing every phase of life together. The ups, the downs, and everything in between. Her friendship has never wavered, and I'm so grateful she'll be by my side on my big day.",
      photoUrl: '/images/wedding-party/Gabi_Cain_new.jpg',
      sortOrder: 3,
      isFeatured: false
    },
    {
      id: '4',
      name: 'Heather Gonzales',
      role: 'Bridesmaid',
      side: 'bride',
      bio: "Heather is not only my cousin but also someone I've looked up to for as long as I can remember. Over the last three years, we've grown even closer and she's become the voice of reason in my ear. I'm so grateful she's making the trip from New York to stand by my side as I say \"I do\"!",
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
      photoUrl: '/images/wedding-party/Grayson_Heyart_new.jpeg',
      sortOrder: 5,
      isFeatured: false
    }
  ]

  const groomsSide: WeddingPartyMember[] = [
    {
      id: 'g1',
      name: 'Aiden Puckett',
      role: 'Best Man',
      side: 'groom',
      bio: "Aiden is the best kind of friend a man can have. The kind of friend that is giving without question and expectation, that will cheer for you louder than anyone in the crowd. The kind of friend you'd take a bullet for without hesitation because you know he'd do the same for you. He's a clear pick on the groomsman team and has earned the right to be team captain as my best man.",
      photoUrl: '/images/wedding-party/Aiden_Pucket.jpg',
      sortOrder: 1,
      isFeatured: true
    },
    {
      id: 'g2',
      name: 'Andre Pratt',
      role: 'Groomsman',
      side: 'groom',
      bio: "Andre and I from day one got along perfectly. From then on it was nothing but up as our friendship formed fast and strong. Even disregarding the fact that people always say we look like brothers— and often getting mistaken for each other, he truly feels like family to me now. Andre is a strong hitter on the groomsman team.",
      photoUrl: '/images/wedding-party/Andre_Pratt.jpg',
      sortOrder: 2,
      isFeatured: false
    },
    {
      id: 'g3',
      name: 'Braden Chaddic',
      role: 'Groomsman',
      side: 'groom',
      bio: "Braden and I had seen each other around but our friendship really formed when he invited me to a \"wine night\" he was helping plan. I was more or less shocked because I didn't think we were super close but obviously I was stoked. That's the kind of man Braden is. He's social, inclusive, and caring. He's been an amazing friend since that day and is still someone I can rely on no matter the hour. Clear pick for the groomsman team.",
      photoUrl: '/images/wedding-party/Braden_Chaddic.jpg',
      sortOrder: 3,
      isFeatured: false
    },
    {
      id: 'g4',
      name: 'Trenton Burton',
      role: 'Groomsman',
      side: 'groom',
      bio: "Trenton is my longest standing friend. He's seen me at my weirdest in 6th grade, when I had no social skills but desperately wanted to have a friend in this new school. He made the unfortunate mistake of mentioning he had seen some of this show I was interested in at the time. And so, in true socially awkward 6th grader fashion, all I did all day everyday was make references to the show and talk about the most recent episode I'd seen. I don't know what possessed him to decide I was friendship material after that but I'm so happy he did. Trenton is, to this day, the funniest man I know and always has me laughing until my stomach aches without even trying. He's seen me through all my phases of life and has been on the groomsman team longer than the groomsman team has been a thing.",
      photoUrl: '/images/wedding-party/Trenton_Burton.jpeg',
      sortOrder: 4,
      isFeatured: false
    }
  ]

  const officiant: WeddingPartyMember[] = [
    {
      id: 'officiant',
      name: 'J. Murdock',
      role: 'Officiant',
      side: 'officiant',
      bio: "J. Murdock will be officiating Emme and Connor's wedding. J. and Emme go way back to their Colorado days, where he had the privilege of serving as her youth pastor for churches in Denver and Boulder. These days, J. works as a chaplain in Northern California, helping people find hope and meaning in life's biggest moments. Outside of work, J. is equally at home leading a wedding ceremony, telling a good story, or trying out new recipes in the kitchen.\n\nIt is an honor for him to preside over Emme and Connor's special day, and J. is thrilled to stand with couple as they are surrounded by the love of family and friends.",
      photoUrl: '/images/wedding-party/J_Murdock.jpg',
      sortOrder: 1,
      isFeatured: true
    }
  ]

  const flowerGirlsAndRingBearers: WeddingPartyMember[] = [
    {
      id: '6',
      name: 'Sophia Walters',
      role: 'Flower Girl',
      side: 'kids',
      bio: "Sophia is Emme's sweet niece who will be spreading flower petals down the aisle on the big day. She's the daughter of Emme's brother Ethan and sister-in-law Amber.",
      relationship: 'Niece (Ethan & Amber\'s daughter)',
      photoUrl: '/images/wedding-party/Sophia_Walters_new.jpg',
      sortOrder: 1,
      isFeatured: false
    },
    {
      id: '7',
      name: 'Reagan Walters',
      role: 'Flower Girl',
      side: 'kids',
      bio: "Reagan is another one of Emme's precious nieces who will be joining Sophia as a flower girl. She's the daughter of Emme's brother Tom and sister-in-law Jennifer.",
      relationship: 'Niece (Tom & Jennifer\'s daughter)',
      photoUrl: '/images/wedding-party/Reagan_Walters_new.jpg',
      sortOrder: 2,
      isFeatured: false
    },
    {
      id: '8',
      name: 'Daniel Walters',
      role: 'Ring Bearer',
      side: 'kids',
      bio: "Daniel is Emme's nephew who has the very important job of carrying the rings down the aisle. He's the son of Emme's brother Ethan and sister-in-law Amber, and Sophia's younger brother.",
      relationship: 'Nephew (Ethan & Amber\'s son, Sophia\'s brother)',
      photoUrl: '/images/wedding-party/Daniel_Walters_new.jpg',
      sortOrder: 3,
      isFeatured: false
    },
    {
      id: '9',
      name: 'Andrew Walters',
      role: 'Ring Bearer',
      side: 'kids',
      bio: "Andrew is Emme's nephew and the first of nieces and nephews. Andrew has the important task of keeping track of Daniel and the ring. He's the oldest son of Emme's brother Tom and sister-in-law Jennifer and Reagan's big brother.",
      relationship: 'Nephew (Tom & Jennifer\'s son, Reagan\'s brother)',
      photoUrl: '/images/wedding-party/Andrew_Walters_new.jpg',
      sortOrder: 4,
      isFeatured: false
    }
  ]

  const formatRole = (role: string) => {
    return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const getRoleColor = (role: string) => {
    if (role === 'Maid of Honor' || role === 'Best Man') {
      return 'text-yellow-600 font-semibold'
    }
    if (role === 'Officiant') {
      return 'text-purple-600 font-semibold'
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
            style={{
              objectPosition:
                member.name === 'L Walters' ? 'center 35%' :
                member.name === 'Grayson Heyart' ? 'center 15%' :
                member.name === 'Daniel Walters' ? 'center 25%' :
                member.name === 'Sophia Walters' ? 'center 20%' :
                member.name === 'Reagan Walters' ? 'center 5%' :
                member.name === 'Andrew Walters' ? 'center 15%' :
                member.name === 'Trenton Burton' ? 'center 22%' :
                member.name === 'J. Murdock' ? 'center 45%' :
                'center center'
            }}
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
              ⭐ {member.role === 'Best Man' ? 'Best Man' :
                  member.role === 'Maid of Honor' ? 'Maid of Honor' :
                  member.role}
            </span>
          </div>
        )}
      </div>
      
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-1" style={{ hyphens: 'none', wordBreak: 'keep-all' }}>{member.name}</h3>
        <p className={`text-sm mb-2 ${getRoleColor(member.role)}`} style={{ hyphens: 'none', wordBreak: 'keep-all' }}>
          {member.role}
        </p>
        
        {member.relationship && member.role !== 'Flower Girl' && member.role !== 'Ring Bearer' && (
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
              The special people celebrating with Emme & Connor
            </p>
            <div className="mt-4">
              <Link
                href="/"
                className="text-green-600 hover:text-green-800 underline"
              >
                Back to Wedding Website
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
            <p className="text-gray-600">Supporting Connor on his special day</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
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

        {/* Officiant */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">⛪ Officiant</h2>
            <p className="text-gray-600">The special person uniting Emme & Connor in marriage</p>
          </div>

          <div className="flex justify-center max-w-5xl mx-auto">
            <div className="max-w-sm w-full">
              {officiant.map((member) => (
                <WeddingPartyCard key={member.id} member={member} />
              ))}
            </div>
          </div>
        </div>

        {/* Flower Girls and Ring Bearers */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">🌸💍 Flower Girls and Ring Bearers</h2>
            <p className="text-gray-600">Our special little helpers making the day even more magical</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {flowerGirlsAndRingBearers.map((member) => (
              <WeddingPartyCard key={member.id} member={member} />
            ))}
          </div>
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
            Emme & Connor
          </p>
        </div>
      </div>
    </div>
  )
}