export type TierType = 'fixed' | 'goal'

/** Goal tiers (flights, accommodation) render a public progress bar. */
export function tierType(category: string): TierType {
  return category === 'flights' || category === 'accommodation' ? 'goal' : 'fixed'
}

/** Only the Flight (flights) lets the donor enter their own amount. */
export function isVariable(category: string): boolean {
  return category === 'flights'
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
