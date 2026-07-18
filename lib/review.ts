import { Prisma } from '@prisma/client'

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
