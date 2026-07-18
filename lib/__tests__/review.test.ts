import {
  AWAITING_REVIEW,
  NOT_AWAITING_REVIEW,
  guestListStatus,
  formatAddedDate,
} from '@/lib/review'

it('AWAITING_REVIEW targets unreviewed self-RSVP rows only', () => {
  expect(AWAITING_REVIEW).toEqual({ source: 'self_rsvp', reviewedAt: null })
})

it('NOT_AWAITING_REVIEW is the negation used to exclude them elsewhere', () => {
  expect(NOT_AWAITING_REVIEW).toEqual({ NOT: { source: 'self_rsvp', reviewedAt: null } })
})

describe('guestListStatus', () => {
  it('is "matched" for an imported guest regardless of reviewedAt', () => {
    expect(guestListStatus({ source: 'imported', reviewedAt: null })).toEqual({ kind: 'matched' })
  })
  it('is "added" for an approved self-RSVP, carrying the approval date', () => {
    const d = new Date('2026-07-18T18:00:00Z')
    expect(guestListStatus({ source: 'self_rsvp', reviewedAt: d })).toEqual({ kind: 'added', addedAt: d })
  })
  it('is "pending" for an unreviewed self-RSVP', () => {
    expect(guestListStatus({ source: 'self_rsvp', reviewedAt: null })).toEqual({ kind: 'pending' })
  })
})

it('formatAddedDate renders a friendly Denver-time date', () => {
  expect(formatAddedDate(new Date('2026-07-18T18:00:00Z'))).toBe('Jul 18, 2026')
})
