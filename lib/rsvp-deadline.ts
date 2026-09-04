// How long a guest has left to answer their RSVP.
//
// Nicolle: "an email... that says something like, 'Just a gentle reminder that you
// have [X] days to reply to the RSVP before your response is listed as no'... The
// deadline is 8-20-2026 so the system could calculate how many days to put in the
// email."
//
// The count is done in the wedding's own timezone. Left to the server's clock it
// would tick over at UTC midnight — which in Denver is late the previous evening —
// so a note sent on the 19th could tell a guest they had one day fewer than they do.

/** Fallback when no deadline has been saved: the date Nicolle gave. */
export const DEFAULT_RSVP_DEADLINE = '2026-08-20'

const ZONE = 'America/Denver'

/** yyyy-mm-dd for an instant, as it reads on a calendar in the wedding's timezone. */
function localDateString(at: Date): string {
  // en-CA formats as yyyy-mm-dd, which sorts and parses predictably.
  return at.toLocaleDateString('en-CA', { timeZone: ZONE })
}

/** Midnight UTC for a yyyy-mm-dd, so two of these subtract to whole days exactly. */
function toUtcMidnight(yyyyMmDd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return null
  const ms = Date.parse(`${yyyyMmDd}T00:00:00Z`)
  return Number.isNaN(ms) ? null : ms
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Whole days from today until the deadline, both read as calendar dates in the
 * wedding's timezone.
 *
 *   3  → three days left
 *   0  → the deadline IS today; today is the last day to reply
 *   -1 → yesterday was the deadline
 *
 * Null when the deadline isn't a usable date, so a mistyped setting can't put a
 * NaN into a guest's inbox.
 */
export function daysUntilDeadline(deadline: string, now: Date = new Date()): number | null {
  const end = toUtcMidnight(deadline)
  const today = toUtcMidnight(localDateString(now))
  if (end === null || today === null) return null
  return Math.round((end - today) / DAY_MS)
}

/**
 * "3 days" / "1 day" / "today" — the phrase that goes where Nicolle wrote [X].
 * Only meaningful for a deadline that hasn't passed; callers check that first.
 */
export function daysLeftPhrase(days: number): string {
  if (days <= 0) return 'today'
  return `${days} day${days === 1 ? '' : 's'}`
}

/** e.g. "Thursday, August 20, 2026" — the deadline spelled out in the note. */
export function formatDeadline(deadline: string): string {
  const ms = toUtcMidnight(deadline)
  if (ms === null) return deadline
  return new Date(ms).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: 'UTC', // already normalised to a calendar date; don't shift it again
  })
}
