import {
  daysUntilDeadline,
  daysLeftPhrase,
  formatDeadline,
  DEFAULT_RSVP_DEADLINE,
} from '@/lib/rsvp-deadline'

// Denver is UTC-6 in August, so an instant late in the evening there is already the
// NEXT day in UTC. Counting on the server's clock would quietly hand a guest one day
// fewer than they actually have.
const denverEvening = (yyyyMmDd: string) => new Date(`${yyyyMmDd}T23:30:00-06:00`)
const denverMorning = (yyyyMmDd: string) => new Date(`${yyyyMmDd}T08:00:00-06:00`)

describe('daysUntilDeadline', () => {
  it('counts the days Nicolle wants in the email', () => {
    // Her deadline is 8-20; on the 17th that is three days.
    expect(daysUntilDeadline('2026-08-20', denverMorning('2026-08-17'))).toBe(3)
  })

  it('is 0 on the deadline itself', () => {
    expect(daysUntilDeadline('2026-08-20', denverMorning('2026-08-20'))).toBe(0)
  })

  it('goes negative once the deadline has passed', () => {
    expect(daysUntilDeadline('2026-08-20', denverMorning('2026-08-22'))).toBe(-2)
  })

  // The bug this module exists to avoid.
  it('does not lose a day for a note sent late in the evening in Denver', () => {
    // 23:30 on the 19th in Denver is already the 20th in UTC.
    expect(daysUntilDeadline('2026-08-20', denverEvening('2026-08-19'))).toBe(1)
  })

  it('is the same all day, morning or evening', () => {
    expect(daysUntilDeadline('2026-08-20', denverMorning('2026-08-18')))
      .toBe(daysUntilDeadline('2026-08-20', denverEvening('2026-08-18')))
  })

  it('spans a month boundary correctly', () => {
    expect(daysUntilDeadline('2026-09-02', denverMorning('2026-08-30'))).toBe(3)
  })

  // A mistyped deadline must not put "NaN days" in a guest's inbox.
  it('returns null for anything that is not a date', () => {
    expect(daysUntilDeadline('the 20th', denverMorning('2026-08-17'))).toBeNull()
    expect(daysUntilDeadline('', denverMorning('2026-08-17'))).toBeNull()
    expect(daysUntilDeadline('2026-13-45', denverMorning('2026-08-17'))).toBeNull()
  })

  it('defaults to the date she gave', () => {
    expect(DEFAULT_RSVP_DEADLINE).toBe('2026-08-20')
  })
})

describe('daysLeftPhrase', () => {
  it('pluralises', () => {
    expect(daysLeftPhrase(3)).toBe('3 days')
  })

  it('uses the singular for one', () => {
    expect(daysLeftPhrase(1)).toBe('1 day')
  })

  it('says "today" on the last day, not "0 days"', () => {
    expect(daysLeftPhrase(0)).toBe('today')
  })
})

describe('formatDeadline', () => {
  it('spells the date out for the note', () => {
    expect(formatDeadline('2026-08-20')).toBe('Thursday, August 20, 2026')
  })

  // Formatted off a bare calendar date, so it must not slip to the 19th.
  it('does not shift the day', () => {
    expect(formatDeadline('2026-08-20')).toContain('20')
  })

  it('passes through something it cannot parse rather than inventing a date', () => {
    expect(formatDeadline('whenever')).toBe('whenever')
  })
})
