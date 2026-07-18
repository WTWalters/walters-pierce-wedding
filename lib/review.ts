import type { Prisma } from '@prisma/client'

// A Guest row is "awaiting review" when it's an unmatched self-RSVP that no admin
// has approved or matched yet. Such rows appear ONLY in the To Review queue — never
// in the main guest list or any headcount — until an admin acts on them.
export const AWAITING_REVIEW: Prisma.GuestWhereInput = {
  source: 'self_rsvp',
  reviewedAt: null,
}

// Negation: merge into any where-clause that must exclude the review queue.
export const NOT_AWAITING_REVIEW: Prisma.GuestWhereInput = {
  NOT: { source: 'self_rsvp', reviewedAt: null },
}

// How a guest came to be on the list — the distinction Nicolle asked to see:
//  - matched: was on the imported/original list (or added by hand via Add Guest),
//             so an RSVP simply matched an existing record.
//  - added:   was NOT on the list, self-RSVP'd, and an admin approved them from
//             the To Review queue on `addedAt` (their reviewedAt timestamp).
//  - pending: an unmatched self-RSVP still sitting in To Review (not yet approved).
export type GuestListStatus =
  | { kind: 'matched' }
  | { kind: 'added'; addedAt: Date }
  | { kind: 'pending' }

export function guestListStatus(g: {
  source: string | null
  reviewedAt: Date | string | null
}): GuestListStatus {
  if (g.source === 'imported') return { kind: 'matched' }
  if (g.reviewedAt) return { kind: 'added', addedAt: new Date(g.reviewedAt) }
  return { kind: 'pending' }
}

// Human-friendly "added on" date, e.g. "Jul 18, 2026", in the wedding's timezone
// so the day never drifts by one for late-evening approvals.
export function formatAddedDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Denver',
  })
}
