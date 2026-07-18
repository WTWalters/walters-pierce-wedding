import { AWAITING_REVIEW, NOT_AWAITING_REVIEW } from '@/lib/review'

it('AWAITING_REVIEW targets unreviewed self-RSVP rows only', () => {
  expect(AWAITING_REVIEW).toEqual({ source: 'self_rsvp', reviewedAt: null })
})

it('NOT_AWAITING_REVIEW is the negation used to exclude them elsewhere', () => {
  expect(NOT_AWAITING_REVIEW).toEqual({ NOT: { source: 'self_rsvp', reviewedAt: null } })
})
