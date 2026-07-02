import { normalizeName, isBlockedName } from '@/lib/blocklist'

describe('normalizeName', () => {
  it('lowercases, strips punctuation/digits, collapses whitespace', () => {
    expect(normalizeName('  Thomas   WALTERS ')).toBe('thomas walters')
    expect(normalizeName("Marci-Ann O'Harris3")).toBe('marci ann o harris')
  })
})

describe('isBlockedName', () => {
  const blocklist = [
    'marci harris', 'marciann harris', 'marci ann harris',
    'montana harris', 'tom walters', 'thomas walters',
  ]
  it.each([
    ['Marci', 'Harris'],
    ['MarciAnn', 'Harris'],
    ['marci ann', 'HARRIS'],
    ['Montana', 'Harris'],
    ['Tom', 'Walters'],
    ['  Thomas ', ' Walters '],
  ])('blocks %s %s', (first, last) => {
    expect(isBlockedName(first, last, blocklist)).toBe(true)
  })
  it.each([
    ['Marcus', 'Harris'],
    ['Tom', 'Waters'],
    ['Nicolle', 'Walters'],
  ])('does not block %s %s', (first, last) => {
    expect(isBlockedName(first, last, blocklist)).toBe(false)
  })
  it('returns false for empty blocklist', () => {
    expect(isBlockedName('Tom', 'Walters', [])).toBe(false)
  })
})
