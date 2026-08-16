// How a party breaks down into adults and children.
//
// Nicolle's rule: the number in a party IS the adults plus the children. She enters
// both by hand on Add/Edit Guest and the party size follows from them, rather than
// being a third number she has to keep in agreement with the other two.
//
// The point of all this is the caterer and the bar, who need a firm adult count —
// so a party nobody has broken out yet must never be quietly counted as adults. It
// is reported separately as `unspecified`, which reads as "still to enter" instead
// of silently inflating a number someone will cater against.

export type MixInput = {
  adults?: number | null
  children?: number | null
}

/**
 * The number in a party: adults + children.
 *
 * Null when neither has been entered — "not broken out yet", which is a different
 * thing from a party of zero and must not collapse into one.
 */
export function partySize(mix: MixInput): number | null {
  const adults = mix.adults ?? null
  const children = mix.children ?? null
  if (adults === null && children === null) return null
  return (adults ?? 0) + (children ?? 0)
}

/** True when this party has had its make-up entered at all. */
export function hasMix(mix: MixInput): boolean {
  return partySize(mix) !== null
}

/**
 * Read the Adults / Children fields off a request body. A blank field is null
 * ("not entered"); anything that isn't a whole number ≥ 0 is treated the same way
 * rather than becoming a NaN that would poison every total downstream.
 */
export function readMix(body: { adults?: unknown; children?: unknown }): {
  adults: number | null
  children: number | null
} {
  const read = (raw: unknown): number | null => {
    if (raw == null || raw === '') return null
    const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
    return Number.isInteger(n) && n >= 0 ? n : null
  }
  return { adults: read(body.adults), children: read(body.children) }
}

export type MixTotals = {
  adults: number
  children: number
  /** People in parties with no breakdown on file yet. */
  unspecified: number
}

export type MixParty = MixInput & {
  /**
   * This party's contribution to the headcount the card shows. Passed in rather
   * than derived, because "Not Attending" counts surrendered seats — a number the
   * party's own adults/children can't produce.
   */
  people: number
}

/**
 * Sum parties into adults / children / unspecified.
 *
 * Invariant, and the reason the caller passes `people`: the three returned numbers
 * always add up to the total people passed in. A breakdown that doesn't cover a
 * party's headcount (she entered 2 adults on a party of 4, or the party declined
 * and surrendered more seats than it ever broke out) leaves the shortfall in
 * `unspecified` instead of letting the card disagree with the total above it.
 * A breakdown that overshoots is trusted as far as the headcount and no further,
 * so no card can exceed its own total.
 */
export function sumMix(parties: MixParty[]): MixTotals {
  let adults = 0
  let children = 0
  let unspecified = 0

  for (const party of parties) {
    const people = Math.max(0, party.people)
    const size = partySize(party)

    if (size === null || size === 0) {
      unspecified += people
      continue
    }

    // Scale nothing — just cap at the headcount, taking adults first: an adult
    // count is what the caterer and bar are quoting against, so it is the half to
    // preserve when the two numbers disagree.
    const partyAdults = Math.min(Math.max(0, party.adults ?? 0), people)
    const partyChildren = Math.min(Math.max(0, party.children ?? 0), people - partyAdults)

    adults += partyAdults
    children += partyChildren
    unspecified += people - partyAdults - partyChildren
  }

  return { adults, children, unspecified }
}

/**
 * "3 adults · 1 child", for under a summary card. Returns '' when there is
 * nothing broken out at all, so the card renders its bare total unchanged.
 */
export function formatMix(totals: MixTotals): string {
  const parts: string[] = []
  if (totals.adults > 0) parts.push(`${totals.adults} adult${totals.adults === 1 ? '' : 's'}`)
  if (totals.children > 0) parts.push(`${totals.children} ${totals.children === 1 ? 'child' : 'children'}`)
  if (parts.length === 0) return ''
  if (totals.unspecified > 0) parts.push(`${totals.unspecified} to enter`)
  return parts.join(' · ')
}
