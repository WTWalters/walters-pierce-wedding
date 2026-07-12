import { assertSeatCap } from '@/lib/guests'

describe('assertSeatCap', () => {
  it('rejects rsvpd greater than reserved', () => {
    expect(assertSeatCap({ reservedSeats: 7, rsvpdCount: 9 }))
      .toEqual({ ok: false, message: 'RSVP count (9) exceeds reserved seats (7) for this party' })
  })
  it('allows rsvpd equal to reserved', () => {
    expect(assertSeatCap({ reservedSeats: 7, rsvpdCount: 7 })).toEqual({ ok: true })
  })
  it('allows rsvpd below reserved', () => {
    expect(assertSeatCap({ reservedSeats: 7, rsvpdCount: 2 })).toEqual({ ok: true })
  })
  it('is a no-op when either value is null/undefined', () => {
    expect(assertSeatCap({ reservedSeats: null, rsvpdCount: 9 })).toEqual({ ok: true })
    expect(assertSeatCap({ reservedSeats: 7, rsvpdCount: null })).toEqual({ ok: true })
    expect(assertSeatCap({})).toEqual({ ok: true })
  })
})

import { formatPartyName } from '@/lib/guests'

describe('formatPartyName', () => {
  it('joins a couple with an ampersand', () => {
    expect(formatPartyName({
      firstName: 'Andre', lastName: 'Justen-Pratt',
      partnerFirstName: 'Chloe', partnerLastName: 'Hirai',
    })).toBe('Andre Justen-Pratt & Chloe Hirai')
  })
  it('returns a single name when no partner', () => {
    expect(formatPartyName({ firstName: 'Amethyst', lastName: 'Johannes' }))
      .toBe('Amethyst Johannes')
  })
  it('handles a partner first name with no partner last name', () => {
    expect(formatPartyName({
      firstName: 'Ben', lastName: 'Bright', partnerFirstName: 'Jessica',
    })).toBe('Ben Bright & Jessica')
  })
})
