export type TierType = 'fixed' | 'goal'

/** Goal tiers (flights, accommodation) render a public progress bar. */
export function tierType(category: string): TierType {
  return category === 'flights' || category === 'accommodation' ? 'goal' : 'fixed'
}

/**
 * Goal items (Flight + Hotel) let the donor choose their amount — quick $50/$100
 * picks or a custom value — contributing toward the goal. Fixed treats charge their price.
 */
export function isVariable(category: string): boolean {
  return tierType(category) === 'goal'
}

export type ChargeResult = { ok: true; cents: number } | { ok: false; message: string }

/**
 * The amount to charge, in cents. Variable items use the donor's dollar amount
 * (min $5); every other item charges its `targetAmount`.
 */
export function resolveChargeCents(
  item: { category: string; targetAmount: number },
  requestedDollars?: number
): ChargeResult {
  if (isVariable(item.category)) {
    if (requestedDollars == null || !(requestedDollars >= 5)) {
      return { ok: false, message: 'Please enter an amount of at least $5.' }
    }
    return { ok: true, cents: Math.round(requestedDollars * 100) }
  }
  return { ok: true, cents: Math.round(Number(item.targetAmount) * 100) }
}
