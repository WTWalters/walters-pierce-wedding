export type SeatCapInput = {
  reservedSeats?: number | null
  rsvpdCount?: number | null
}

export type SeatCapResult = { ok: true } | { ok: false; message: string }

/**
 * A party's RSVP'd headcount may never exceed its reserved seats.
 * Null on either side means "not set yet" — no constraint to enforce.
 */
export function assertSeatCap({ reservedSeats, rsvpdCount }: SeatCapInput): SeatCapResult {
  if (
    reservedSeats != null &&
    rsvpdCount != null &&
    rsvpdCount > reservedSeats
  ) {
    return {
      ok: false,
      message: `RSVP count (${rsvpdCount}) exceeds reserved seats (${reservedSeats}) for this party`,
    }
  }
  return { ok: true }
}

export type PartyNameInput = {
  firstName: string
  lastName: string
  partnerFirstName?: string | null
  partnerLastName?: string | null
}

/**
 * Renders the party's display name:
 *   - solo:                    "A Blake"
 *   - shared last name:        "A & B Blake"  (partner last name blank or equal)
 *   - different last names:    "A Blake & C Doe"
 */
export function formatPartyName(g: PartyNameInput): string {
  const lastName = g.lastName.trim()
  const primary = `${g.firstName} ${lastName}`.trim()
  if (!g.partnerFirstName) return primary

  const partnerLast = (g.partnerLastName ?? '').trim()
  const sharesLastName = partnerLast === '' || partnerLast === lastName
  if (sharesLastName) {
    return `${g.firstName.trim()} & ${g.partnerFirstName.trim()} ${lastName}`.trim()
  }
  return `${primary} & ${g.partnerFirstName.trim()} ${partnerLast}`.trim()
}
