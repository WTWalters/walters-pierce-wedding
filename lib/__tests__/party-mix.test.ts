import { partySize, hasMix, sumMix, formatMix } from '@/lib/party-mix'

describe('partySize', () => {
  it('is adults plus children — the number in the party', () => {
    expect(partySize({ adults: 2, children: 3 })).toBe(5)
  })

  it('treats a missing half as zero once the other half is entered', () => {
    expect(partySize({ adults: 2, children: null })).toBe(2)
    expect(partySize({ adults: null, children: 1 })).toBe(1)
  })

  it('is null when neither has been entered — "not broken out", not "nobody"', () => {
    expect(partySize({})).toBeNull()
    expect(partySize({ adults: null, children: null })).toBeNull()
  })

  it('distinguishes an explicit zero from an unentered field', () => {
    expect(partySize({ adults: 0, children: 0 })).toBe(0)
    expect(hasMix({ adults: 0, children: 0 })).toBe(true)
    expect(hasMix({})).toBe(false)
  })
})

describe('sumMix', () => {
  it('sums adults and children across parties', () => {
    expect(
      sumMix([
        { adults: 2, children: 1, people: 3 },
        { adults: 2, children: 0, people: 2 },
      ])
    ).toEqual({ adults: 4, children: 1, unspecified: 0 })
  })

  it('never counts an un-broken-out party as adults — the caterer number stays honest', () => {
    const totals = sumMix([
      { adults: 2, children: 2, people: 4 },
      { people: 3 }, // nobody has entered this party's make-up yet
    ])
    expect(totals).toEqual({ adults: 2, children: 2, unspecified: 3 })
  })

  it('always adds back up to the total people passed in', () => {
    const parties = [
      { adults: 2, children: 1, people: 3 },
      { people: 5 },
      { adults: 1, children: 0, people: 4 }, // breakdown short of the headcount
      { adults: 9, children: 9, people: 2 }, // breakdown over the headcount
    ]
    const totals = sumMix(parties)
    const people = parties.reduce((s, p) => s + p.people, 0)
    expect(totals.adults + totals.children + totals.unspecified).toBe(people)
  })

  it('leaves the shortfall unspecified when a breakdown does not cover the party', () => {
    // 2 of a party of 4 broken out: the other 2 are still to enter, not adults.
    expect(sumMix([{ adults: 2, children: 0, people: 4 }])).toEqual({
      adults: 2,
      children: 0,
      unspecified: 2,
    })
  })

  it('caps an overshooting breakdown at the headcount, keeping adults whole', () => {
    // Adults are what the bar quotes against, so they survive the cap first.
    expect(sumMix([{ adults: 3, children: 3, people: 4 }])).toEqual({
      adults: 3,
      children: 1,
      unspecified: 0,
    })
  })

  it('handles an empty list', () => {
    expect(sumMix([])).toEqual({ adults: 0, children: 0, unspecified: 0 })
  })

  it('ignores negative numbers rather than subtracting from a total', () => {
    expect(sumMix([{ adults: -2, children: 1, people: 1 }])).toEqual({
      adults: 0,
      children: 1,
      unspecified: 0,
    })
  })
})

describe('formatMix', () => {
  it('reads as a caption under the card', () => {
    expect(formatMix({ adults: 3, children: 1, unspecified: 0 })).toBe('3 adults · 1 child')
  })

  it('singularises both words', () => {
    expect(formatMix({ adults: 1, children: 2, unspecified: 0 })).toBe('1 adult · 2 children')
  })

  it('omits a zero half', () => {
    expect(formatMix({ adults: 4, children: 0, unspecified: 0 })).toBe('4 adults')
  })

  it('flags how many are still to enter', () => {
    expect(formatMix({ adults: 2, children: 0, unspecified: 5 })).toBe('2 adults · 5 to enter')
  })

  it('returns nothing when there is no breakdown at all, so the card shows its bare total', () => {
    expect(formatMix({ adults: 0, children: 0, unspecified: 9 })).toBe('')
  })
})
