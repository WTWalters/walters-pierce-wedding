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
  it('both goal items (Flight + Hotel) let the donor choose the amount', () => {
    expect(isVariable('flights')).toBe(true)
    expect(isVariable('accommodation')).toBe(true)
    expect(isVariable('dining')).toBe(false)
    expect(isVariable('activities')).toBe(false)
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
  it('charges the donor amount for the Hotel goal (accommodation, choose amount)', () => {
    expect(resolveChargeCents({ category: 'accommodation', targetAmount: 1300 }, 100)).toEqual({ ok: true, cents: 10000 })
    expect(resolveChargeCents({ category: 'accommodation', targetAmount: 1300 }).ok).toBe(false)
  })
})
