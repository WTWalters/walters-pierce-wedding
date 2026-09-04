import { matchGiftsToGuests, matchGift, buildGuestIndex, type GuestLike } from '@/lib/gift-match'

const guest = (over: Partial<GuestLike> & { id: string }): GuestLike => ({
  firstName: 'Test',
  lastName: 'Guest',
  ...over,
})

const marilyn = guest({
  id: 'g-marilyn',
  firstName: 'Marilyn',
  lastName: 'Foster',
  email: null,
})

const whitney = guest({
  id: 'g-whitney',
  firstName: 'Whitney',
  lastName: 'Walters',
  email: 'Whitney.Walters@gmail.com',
})

describe('matchGiftsToGuests — the cases Nicolle reported', () => {
  it("finds Aunt Marilyn's hand-recorded gifts with no email on them", () => {
    const gifts = [
      { id: 'c1', contributorName: 'Aunt Marilyn', contributorEmail: '' },
      { id: 'c2', contributorName: 'Aunt Marilyn', contributorEmail: '' },
    ]
    const byGuest = matchGiftsToGuests(gifts, [marilyn, whitney])
    expect(byGuest.get('g-marilyn')?.map((g) => g.id)).toEqual(['c1', 'c2'])
  })

  it('finds the $25 Buy Me a Coffee gift given under a differently-cased email', () => {
    const gifts = [{ id: 'c3', contributorName: 'Whitney', contributorEmail: 'whitney.walters@GMAIL.com' }]
    const byGuest = matchGiftsToGuests(gifts, [marilyn, whitney])
    expect(byGuest.get('g-whitney')?.map((g) => g.id)).toEqual(['c3'])
  })

  it('finds a gift whose Stripe email is nothing like the guest record, by name', () => {
    const gifts = [{ id: 'c4', contributorName: 'Whitney Walters', contributorEmail: 'someone-else@work.example' }]
    const byGuest = matchGiftsToGuests(gifts, [marilyn, whitney])
    expect(byGuest.get('g-whitney')?.map((g) => g.id)).toEqual(['c4'])
  })
})

describe('matchGiftsToGuests — precedence', () => {
  it('trusts an explicit guest link over a name that says otherwise', () => {
    const gifts = [{ id: 'c5', guestId: 'g-marilyn', contributorName: 'Whitney Walters', contributorEmail: '' }]
    const byGuest = matchGiftsToGuests(gifts, [marilyn, whitney])
    expect(byGuest.get('g-marilyn')?.map((g) => g.id)).toEqual(['c5'])
    expect(byGuest.has('g-whitney')).toBe(false)
  })

  it('ignores a link pointing at a guest who is not in the set being matched', () => {
    const gifts = [{ id: 'c6', guestId: 'g-deleted', contributorName: 'Marilyn Foster' }]
    const byGuest = matchGiftsToGuests(gifts, [marilyn])
    // Falls through to the name rather than losing the gift entirely.
    expect(byGuest.get('g-marilyn')?.map((g) => g.id)).toEqual(['c6'])
  })

  it('reports how each match was made', () => {
    const index = buildGuestIndex([marilyn, whitney])
    expect(matchGift({ guestId: 'g-marilyn' }, index).reason).toBe('linked')
    expect(matchGift({ contributorEmail: 'whitney.walters@gmail.com' }, index).reason).toBe('email')
    expect(matchGift({ contributorName: 'Aunt Marilyn' }, index).reason).toBe('name')
    expect(matchGift({ contributorName: 'Nobody At All' }, index)).toEqual({ guestId: null, reason: null })
  })
})

describe('matchGiftsToGuests — refusing a wrong match', () => {
  it('matches neither when a first name is ambiguous across two guests', () => {
    const otherMarilyn = guest({ id: 'g-marilyn-2', firstName: 'Marilyn', lastName: 'Pierce' })
    const gifts = [{ id: 'c7', contributorName: 'Aunt Marilyn' }]
    const byGuest = matchGiftsToGuests(gifts, [marilyn, otherMarilyn])
    expect(byGuest.size).toBe(0)
  })

  it('still matches on the full name when only the first name is ambiguous', () => {
    const otherMarilyn = guest({ id: 'g-marilyn-2', firstName: 'Marilyn', lastName: 'Pierce' })
    const gifts = [{ id: 'c8', contributorName: 'Marilyn Foster' }]
    const byGuest = matchGiftsToGuests(gifts, [marilyn, otherMarilyn])
    expect(byGuest.get('g-marilyn')?.map((g) => g.id)).toEqual(['c8'])
  })

  it('does not treat a guest and their own partner as an ambiguity', () => {
    const couple = guest({
      id: 'g-couple',
      firstName: 'Morgan',
      lastName: 'Pierce',
      partnerFirstName: 'Morgan',
      partnerLastName: 'Pierce',
    })
    const byGuest = matchGiftsToGuests([{ id: 'c9', contributorName: 'Morgan Pierce' }], [couple])
    expect(byGuest.get('g-couple')?.map((g) => g.id)).toEqual(['c9'])
  })
})

describe('matchGiftsToGuests — name handling', () => {
  const couple = guest({
    id: 'g-pierce',
    firstName: 'Morgan',
    lastName: 'Pierce',
    partnerFirstName: 'Nathan',
    partnerEmail: 'nathan@example.com',
  })

  it('matches a joint gift to the party that gave it', () => {
    const byGuest = matchGiftsToGuests([{ id: 'c10', contributorName: 'Morgan and Nathan Pierce' }], [couple])
    expect(byGuest.get('g-pierce')?.map((g) => g.id)).toEqual(['c10'])
  })

  it("matches a partner who has no last name of their own under the guest's", () => {
    const byGuest = matchGiftsToGuests([{ id: 'c11', contributorName: 'Nathan Pierce' }], [couple])
    expect(byGuest.get('g-pierce')?.map((g) => g.id)).toEqual(['c11'])
  })

  it("matches on the partner's email", () => {
    const byGuest = matchGiftsToGuests([{ id: 'c12', contributorEmail: 'NATHAN@example.com' }], [couple])
    expect(byGuest.get('g-pierce')?.map((g) => g.id)).toEqual(['c12'])
  })

  it('ignores case, accents and punctuation in a typed name', () => {
    const renee = guest({ id: 'g-renee', firstName: 'Renée', lastName: "O'Brien" })
    const byGuest = matchGiftsToGuests([{ id: 'c13', contributorName: 'renee obrien' }], [renee])
    expect(byGuest.get('g-renee')?.map((g) => g.id)).toEqual(['c13'])
  })

  it('matches a giver who signs only as a relation, when that is all they are recorded as', () => {
    const dad = guest({ id: 'g-dad', firstName: 'Dad', lastName: '' })
    const byGuest = matchGiftsToGuests([{ id: 'c14', contributorName: 'Dad' }], [dad])
    expect(byGuest.get('g-dad')?.map((g) => g.id)).toEqual(['c14'])
  })

  it('keeps every gift from one giver together, in the order given', () => {
    const gifts = [
      { id: 'cake', contributorName: 'Aunt Marilyn' },
      { id: 'cash', contributorName: 'Marilyn Foster' },
    ]
    const byGuest = matchGiftsToGuests(gifts, [marilyn])
    expect(byGuest.get('g-marilyn')?.map((g) => g.id)).toEqual(['cake', 'cash'])
  })

  it('leaves an unmatchable gift out entirely', () => {
    const byGuest = matchGiftsToGuests([{ id: 'c15', contributorName: 'A Total Stranger' }], [marilyn])
    expect(byGuest.size).toBe(0)
  })

  it('does not match on an empty name or email', () => {
    const blank = guest({ id: 'g-blank', firstName: 'Blank', lastName: '', email: '' })
    const byGuest = matchGiftsToGuests([{ id: 'c16', contributorName: '', contributorEmail: '' }], [blank])
    expect(byGuest.size).toBe(0)
  })
})
