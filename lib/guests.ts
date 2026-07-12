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
