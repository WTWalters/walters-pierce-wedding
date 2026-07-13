import { tierType, isVariable, resolveChargeCents } from '@/lib/registry'

describe('tierType', () => {
  it('flights and accommodation are goal tiers (progress bar)', () => {
    expect(tierType('flights')).toBe('goal')
    expect(tierType('accommodation')).toBe('goal')
  })
  it('dining and activities are fixed tiers', () => {
    expect(tierType('dining')).toBe('fixed')
    expect(tierType('activities')).toBe('fixed')
  })
})

describe('isVariable', () => {
  it('only flights lets the donor choose the amount', () => {
    expect(isVariable('flights')).toBe(true)
    expect(isVariable('accommodation')).toBe(false)
    expect(isVariable('dining')).toBe(false)
  })
})

describe('resolveChargeCents', () => {
  it('charges the tier target for a fixed item', () => {
    expect(resolveChargeCents({ category: 'dining', targetAmount: 25 })).toEqual({ ok: true, cents: 2500 })
  })
  it('charges the donor amount for the variable Flight (min $5)', () => {
    expect(resolveChargeCents({ category: 'flights', targetAmount: 2000 }, 120)).toEqual({ ok: true, cents: 12000 })
  })
  it('rejects a Flight amount below $5 or missing', () => {
    expect(resolveChargeCents({ category: 'flights', targetAmount: 2000 }, 3).ok).toBe(false)
    expect(resolveChargeCents({ category: 'flights', targetAmount: 2000 }).ok).toBe(false)
  })
  it('charges the fixed $500 for the Hotel (accommodation, not variable)', () => {
    expect(resolveChargeCents({ category: 'accommodation', targetAmount: 500 })).toEqual({ ok: true, cents: 50000 })
  })
})
