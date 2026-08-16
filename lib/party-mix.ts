// How a party breaks down into adults and children.
//
// Nicolle's rule: the number in a party IS the sum of its parts. She enters them by
// hand on Add/Edit Guest and the party size follows, rather than being another
// number she has to keep in agreement with the rest.
//
// Three buckets, and they never overlap:
//   adults21Plus   — of drinking age
//   adultsUnder21  — an adult meal, but nothing from the bar
//   children
//
// The 21+ split is the whole reason there are three rather than two: the caterer
// counts adult meals (both adult buckets), the bar counts only who can drink. Folding
// under-21s in with the rest would make one of those two numbers wrong whichever way
// it went.
//
// And because those numbers get quoted to suppliers, a party nobody has broken out
// yet must never be quietly counted as adults. It is reported separately as
// `unspecified`, which reads as "still to enter" instead of padding an order.

export type MixInput = {
  adults21Plus?: number | null
  adultsUnder21?: number | null
  children?: number | null
}

const clean = (n: number | null | undefined): number | null =>
  typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : null

/**
 * The number in a party: every bucket added together.
 *
 * Null when none has been entered — "not broken out yet", which is a different thing
 * from a party of zero and must not collapse into one.
 */
export function partySize(mix: MixInput): number | null {
  const parts = [clean(mix.adults21Plus), clean(mix.adultsUnder21), clean(mix.children)]
  if (parts.every((p) => p === null)) return null
  return parts.reduce((sum: number, p) => sum + (p ?? 0), 0)
}

/** True when this party has had its make-up entered at all. */
export function hasMix(mix: MixInput): boolean {
  return partySize(mix) !== null
}

/**
 * Read the make-up fields off a request body. A blank field is null ("not entered");
 * anything that isn't a whole number ≥ 0 is treated the same way rather than becoming
 * a NaN that would poison every total downstream.
 */
export function readMix(body: {
  adults21Plus?: unknown
  adultsUnder21?: unknown
  children?: unknown
}): { adults21Plus: number | null; adultsUnder21: number | null; children: number | null } {
  const read = (raw: unknown): number | null => {
    if (raw == null || raw === '') return null
    const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
    return Number.isInteger(n) && n >= 0 ? n : null
  }
  return {
    adults21Plus: read(body.adults21Plus),
    adultsUnder21: read(body.adultsUnder21),
    children: read(body.children),
  }
}

export type MixTotals = {
  adults21Plus: number
  adultsUnder21: number
  children: number
  /** People in parties with no breakdown on file yet. */
  unspecified: number
}

export const EMPTY_MIX: MixTotals = {
  adults21Plus: 0,
  adultsUnder21: 0,
  children: 0,
  unspecified: 0,
}

export type MixParty = MixInput & {
  /**
   * This party's contribution to the headcount the card shows. Passed in rather than
   * derived, because "Not Attending" counts surrendered seats — a number the party's
   * own make-up can't produce.
   */
  people: number
}

/**
 * Sum parties into the three buckets, plus whatever is still to enter.
 *
 * Invariant, and the reason the caller passes `people`: the returned numbers always
 * add up to the total people passed in. A breakdown that doesn't cover a party's
 * headcount leaves the shortfall in `unspecified` instead of letting a card disagree
 * with the total above it. A breakdown that overshoots is trusted only as far as the
 * headcount, so no card can exceed its own total.
 */
export function sumMix(parties: MixParty[]): MixTotals {
  const totals: MixTotals = { ...EMPTY_MIX }

  for (const party of parties) {
    const people = Math.max(0, party.people)
    const size = partySize(party)

    if (size === null || size === 0) {
      totals.unspecified += people
      continue
    }

    // Cap at the headcount, filling in this order. Drinking-age adults go first
    // because that is the number the bar is quoted against, so it is the one to
    // preserve whole when the figures disagree; children give way last since a child
    // counted as an adult is the costlier mistake of the two.
    let left = people
    const take = (n: number | null | undefined) => {
      const got = Math.min(clean(n) ?? 0, left)
      left -= got
      return got
    }
    totals.adults21Plus += take(party.adults21Plus)
    totals.adultsUnder21 += take(party.adultsUnder21)
    totals.children += take(party.children)
    totals.unspecified += left
  }

  return totals
}

/** Adult meals: both adult buckets. What the caterer is quoted against. */
export function adultMeals(totals: MixTotals): number {
  return totals.adults21Plus + totals.adultsUnder21
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * "12 adults 21+ · 3 under 21 · 4 children", for under a summary card. Returns ''
 * when nothing is broken out at all, so the card renders its bare total unchanged.
 */
export function formatMix(totals: MixTotals): string {
  const parts: string[] = []
  if (totals.adults21Plus > 0) parts.push(`${plural(totals.adults21Plus, 'adult', 'adults')} 21+`)
  if (totals.adultsUnder21 > 0) parts.push(`${totals.adultsUnder21} under 21`)
  if (totals.children > 0) parts.push(plural(totals.children, 'child', 'children'))
  if (parts.length === 0) return ''
  if (totals.unspecified > 0) parts.push(`${totals.unspecified} to enter`)
  return parts.join(' · ')
}
