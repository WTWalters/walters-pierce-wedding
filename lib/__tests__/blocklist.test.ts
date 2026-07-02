import { normalizeName, isBlockedName } from '@/lib/blocklist'

describe('normalizeName', () => {
  it('lowercases, strips punctuation/digits, collapses whitespace', () => {
    expect(normalizeName('  Thomas   WALTERS ')).toBe('thomas walters')
    expect(normalizeName("Marci-Ann O'Harris3")).toBe('marci ann o harris')
  })
  it('folds diacritics and unicode marks', () => {
    expect(normalizeName('Marcí Harris')).toBe('marci harris')
    expect(normalizeName('Tôm Wálters')).toBe('tom walters')
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
  it('blocks accented variants of blocked names', () => {
    expect(isBlockedName('Marcí', 'Harris', blocklist)).toBe(true)
    expect(isBlockedName('Tôm', 'Wálters', blocklist)).toBe(true)
  })
  it('returns false for empty names', () => {
    expect(isBlockedName('', '', blocklist)).toBe(false)
  })
})
