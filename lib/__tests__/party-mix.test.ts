import { partySize, hasMix, sumMix, formatMix, adultMeals, readMix } from '@/lib/party-mix'

describe('partySize', () => {
  it('is every bucket added together — the number in the party', () => {
    expect(partySize({ adults21Plus: 2, adultsUnder21: 1, children: 3 })).toBe(6)
  })

  it('treats missing buckets as zero once one has been entered', () => {
    expect(partySize({ adults21Plus: 2 })).toBe(2)
    expect(partySize({ adultsUnder21: 1 })).toBe(1)
    expect(partySize({ children: 1 })).toBe(1)
  })

  it('is null when none has been entered — "not broken out", not "nobody"', () => {
    expect(partySize({})).toBeNull()
    expect(partySize({ adults21Plus: null, adultsUnder21: null, children: null })).toBeNull()
  })

  it('distinguishes an explicit zero from an unentered field', () => {
    expect(partySize({ adults21Plus: 0 })).toBe(0)
    expect(hasMix({ adults21Plus: 0 })).toBe(true)
    expect(hasMix({})).toBe(false)
  })
})

describe('readMix', () => {
  it('reads all three off a form body', () => {
    expect(readMix({ adults21Plus: '2', adultsUnder21: '1', children: '3' }))
      .toEqual({ adults21Plus: 2, adultsUnder21: 1, children: 3 })
  })

  it('treats a blank field as not entered', () => {
    expect(readMix({ adults21Plus: '2', adultsUnder21: '', children: undefined }))
      .toEqual({ adults21Plus: 2, adultsUnder21: null, children: null })
  })

  it('refuses nonsense rather than producing a NaN that poisons every total', () => {
    expect(readMix({ adults21Plus: 'two', adultsUnder21: '-1', children: {} }))
      .toEqual({ adults21Plus: null, adultsUnder21: null, children: null })
  })

  // Truncation, like every other count field on the form. A fraction of a person
  // only reaches here from a hand-made request, and 1 is the sane reading of "1.5".
  it('truncates a fractional count', () => {
    expect(readMix({ children: '1.5' }).children).toBe(1)
  })
})

describe('sumMix', () => {
  it('sums each bucket across parties', () => {
    expect(
      sumMix([
        { adults21Plus: 2, adultsUnder21: 1, children: 1, people: 4 },
        { adults21Plus: 2, adultsUnder21: 0, children: 0, people: 2 },
      ])
    ).toEqual({ adults21Plus: 4, adultsUnder21: 1, children: 1, unspecified: 0 })
  })

  // The reason the third bucket exists at all.
  it('keeps under-21 adults out of the drinking-age number', () => {
    const totals = sumMix([{ adults21Plus: 2, adultsUnder21: 3, children: 0, people: 5 }])
    expect(totals.adults21Plus).toBe(2)
    expect(totals.adultsUnder21).toBe(3)
  })

  it('never counts an un-broken-out party as adults — the bar number stays honest', () => {
    expect(
      sumMix([
        { adults21Plus: 2, adultsUnder21: 0, children: 2, people: 4 },
        { people: 3 }, // nobody has entered this party's make-up yet
      ])
    ).toEqual({ adults21Plus: 2, adultsUnder21: 0, children: 2, unspecified: 3 })
  })

  it('always adds back up to the total people passed in', () => {
    const parties = [
      { adults21Plus: 2, adultsUnder21: 1, children: 1, people: 4 },
      { people: 5 },
      { adults21Plus: 1, children: 0, people: 4 }, // breakdown short of the headcount
      { adults21Plus: 9, adultsUnder21: 9, children: 9, people: 2 }, // and overshooting
    ]
    const totals = sumMix(parties)
    const people = parties.reduce((s, p) => s + p.people, 0)
    expect(totals.adults21Plus + totals.adultsUnder21 + totals.children + totals.unspecified)
      .toBe(people)
  })

  it('leaves the shortfall unspecified when a breakdown does not cover the party', () => {
    expect(sumMix([{ adults21Plus: 2, people: 4 }])).toEqual({
      adults21Plus: 2, adultsUnder21: 0, children: 0, unspecified: 2,
    })
  })

  // Drinking-age adults survive the cap first: that is the number the bar is quoted
  // against, and a child counted as an adult is the costlier mistake.
  it('caps an overshooting breakdown at the headcount, keeping 21+ whole', () => {
    expect(sumMix([{ adults21Plus: 3, adultsUnder21: 2, children: 2, people: 4 }])).toEqual({
      adults21Plus: 3, adultsUnder21: 1, children: 0, unspecified: 0,
    })
  })

  it('handles an empty list', () => {
    expect(sumMix([])).toEqual({ adults21Plus: 0, adultsUnder21: 0, children: 0, unspecified: 0 })
  })

  it('ignores negative numbers rather than subtracting from a total', () => {
    expect(sumMix([{ adults21Plus: -2, children: 1, people: 1 }])).toEqual({
      adults21Plus: 0, adultsUnder21: 0, children: 1, unspecified: 0,
    })
  })
})

// The caterer counts adult meals; the bar counts only who can drink. Two different
// numbers off the same breakdown, which is the point of splitting the buckets.
describe('adultMeals', () => {
  it('is both adult buckets together', () => {
    expect(adultMeals({ adults21Plus: 6, adultsUnder21: 4, children: 3, unspecified: 0 })).toBe(10)
  })

  it('differs from the bar count whenever anyone is under 21', () => {
    const totals = { adults21Plus: 6, adultsUnder21: 4, children: 3, unspecified: 0 }
    expect(adultMeals(totals)).not.toBe(totals.adults21Plus)
  })

  it('never counts a child or an un-broken-out party as an adult meal', () => {
    expect(adultMeals({ adults21Plus: 2, adultsUnder21: 0, children: 5, unspecified: 4 })).toBe(2)
  })
})

describe('formatMix', () => {
  it('names all three groups', () => {
    expect(formatMix({ adults21Plus: 3, adultsUnder21: 2, children: 1, unspecified: 0 }))
      .toBe('3 adults 21+ · 2 under 21 · 1 child')
  })

  it('singularises where it should', () => {
    expect(formatMix({ adults21Plus: 1, adultsUnder21: 0, children: 2, unspecified: 0 }))
      .toBe('1 adult 21+ · 2 children')
  })

  it('omits an empty group', () => {
    expect(formatMix({ adults21Plus: 4, adultsUnder21: 0, children: 0, unspecified: 0 }))
      .toBe('4 adults 21+')
  })

  it('flags how many are still to enter', () => {
    expect(formatMix({ adults21Plus: 2, adultsUnder21: 0, children: 0, unspecified: 5 }))
      .toBe('2 adults 21+ · 5 to enter')
  })

  it('returns nothing when there is no breakdown at all, so the card shows its bare total', () => {
    expect(formatMix({ adults21Plus: 0, adultsUnder21: 0, children: 0, unspecified: 9 })).toBe('')
  })
})
