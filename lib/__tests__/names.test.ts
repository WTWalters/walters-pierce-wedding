import { greetingName, shortenTypedName } from '@/lib/names'

describe('greetingName', () => {
  it('prefers the preferred name when set', () => {
    expect(greetingName({ preferredName: 'Grandma', firstName: 'Muriel' })).toBe('Grandma')
  })
  it('falls back to the first name when unset, null, or blank', () => {
    expect(greetingName({ firstName: 'Muriel' })).toBe('Muriel')
    expect(greetingName({ preferredName: null, firstName: 'Muriel' })).toBe('Muriel')
    expect(greetingName({ preferredName: '   ', firstName: 'Muriel' })).toBe('Muriel')
  })
  it('trims surrounding whitespace', () => {
    expect(greetingName({ preferredName: '  Grandma  ', firstName: 'Muriel' })).toBe('Grandma')
    expect(greetingName({ firstName: '  Muriel  ' })).toBe('Muriel')
  })
})

describe('shortenTypedName', () => {
  it("keeps each person's first word (Nicolle's real examples)", () => {
    expect(shortenTypedName('Eleanor Cordi')).toBe('Eleanor')
    expect(shortenTypedName('Morgan and Nathan pierce')).toBe('Morgan and Nathan')
    expect(shortenTypedName('Jill and Jose')).toBe('Jill and Jose')
    expect(shortenTypedName('Dad')).toBe('Dad')
  })
  it('preserves mixed connectors in their original order', () => {
    expect(shortenTypedName('Jill & Jose and Bo Smith')).toBe('Jill & Jose and Bo')
    expect(shortenTypedName('Ann + Bob Jones')).toBe('Ann + Bob')
  })
  it('matches the "and" connector case-insensitively and normalizes spacing', () => {
    expect(shortenTypedName('Morgan  AND  Nathan pierce')).toBe('Morgan and Nathan')
  })
  it('never turns a non-empty name into nothing, and handles blank input', () => {
    expect(shortenTypedName('   Dad   ')).toBe('Dad')
    expect(shortenTypedName('')).toBe('')
    expect(shortenTypedName('   ')).toBe('')
  })
})
