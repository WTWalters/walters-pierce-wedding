import { stripTitleWords, splitPeople } from '@/lib/names'

// Tying a gift to the guest who gave it.
//
// The problem this solves, in Nicolle's words: "there is a disconnect between those
// who've given physical gifts and those who go to the website to give." Aunt Marilyn's
// gifts were recorded by hand with no email (the gift form rightly makes email
// optional — she often doesn't have one for cash), so an email-only lookup found
// nothing and refused to send the thank-you. The $25 through "Buy Me a Coffee" went
// in under whatever address was typed at Stripe checkout, which needn't be the one on
// the guest record.
//
// So there are two ways a gift finds its guest, in order:
//   1. guestId — Nicolle picked the guest on the gift form. Authoritative.
//   2. Email, then name — the fallback for Stripe gifts and for everything recorded
//      before the picker existed.
//
// Fallback matching is deliberately conservative. A gift that matches two guests
// matches neither: sending Aunt Marilyn's thank-you to a different Marilyn is worse
// than the "no gift on file" message Nicolle already knows how to deal with.

export type GuestLike = {
  id: string
  email?: string | null
  firstName: string
  lastName: string
  partnerFirstName?: string | null
  partnerLastName?: string | null
  partnerEmail?: string | null
}

export type GiftLike = {
  guestId?: string | null
  contributorName?: string | null
  contributorEmail?: string | null
}

const normalize = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents, so "Renée" == "Renee"
    .toLowerCase()
    // Apostrophes vanish so "O'Brien" == "OBrien"; other punctuation becomes a
    // space so a hyphenated "Smith-Jones" == the "Smith Jones" someone typed.
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeEmail = (s: string) => s.trim().toLowerCase()

/** Normalized full name plus, separately, the bare first name. */
function nameKeys(first: string, last: string): { full: string; firstOnly: string } {
  const full = normalize(stripTitleWords(`${first} ${last}`))
  const firstOnly = normalize(stripTitleWords(first))
  return { full, firstOnly }
}

/**
 * Every name a gift might reasonably be signed with for this guest: the guest, the
 * partner, and each of them under the other's surname (a partner recorded with no
 * last name of their own shares the guest's).
 */
function guestNameKeys(guest: GuestLike): { full: Set<string>; firstOnly: Set<string> } {
  const full = new Set<string>()
  const firstOnly = new Set<string>()

  const add = (first?: string | null, last?: string | null) => {
    if (!first?.trim()) return
    const keys = nameKeys(first, last ?? '')
    if (keys.full) full.add(keys.full)
    if (keys.firstOnly) firstOnly.add(keys.firstOnly)
  }

  add(guest.firstName, guest.lastName)
  add(guest.partnerFirstName, guest.partnerLastName || guest.lastName)

  return { full, firstOnly }
}

function guestEmails(guest: GuestLike): string[] {
  return [guest.email, guest.partnerEmail]
    .filter((e): e is string => Boolean(e?.trim()))
    .map(normalizeEmail)
}

type Index = {
  byEmail: Map<string, string[]>
  byFullName: Map<string, string[]>
  byFirstName: Map<string, string[]>
  ids: Set<string>
}

function buildIndex(guests: GuestLike[]): Index {
  const byEmail = new Map<string, string[]>()
  const byFullName = new Map<string, string[]>()
  const byFirstName = new Map<string, string[]>()
  const ids = new Set<string>()

  const push = (map: Map<string, string[]>, key: string, id: string) => {
    if (!key) return
    const existing = map.get(key)
    // Same guest indexed twice under one key (partner shares their first name) is
    // not an ambiguity — only two DIFFERENT guests are.
    if (existing) {
      if (!existing.includes(id)) existing.push(id)
    } else {
      map.set(key, [id])
    }
  }

  for (const guest of guests) {
    ids.add(guest.id)
    for (const email of guestEmails(guest)) push(byEmail, email, guest.id)
    const keys = guestNameKeys(guest)
    for (const key of keys.full) push(byFullName, key, guest.id)
    for (const key of keys.firstOnly) push(byFirstName, key, guest.id)
  }

  return { byEmail, byFullName, byFirstName, ids }
}

/** The single id under `key`, or null when absent or ambiguous. */
function unique(map: Map<string, string[]>, key: string): string | null {
  const hits = map.get(key)
  return hits?.length === 1 ? hits[0] : null
}

export type MatchReason = 'linked' | 'email' | 'name' | null

export type GiftMatch = {
  guestId: string | null
  reason: MatchReason
}

/**
 * Which guest a single gift belongs to, given an index of the guests to consider.
 * Exported for the Gifts tab, which shows the match per row.
 */
export function matchGift(gift: GiftLike, index: Index): GiftMatch {
  // 1. An explicit link always wins — it is the one signal a human set on purpose.
  if (gift.guestId && index.ids.has(gift.guestId)) {
    return { guestId: gift.guestId, reason: 'linked' }
  }

  // 2. Email. Exact (normalized) only; no fuzziness on an address.
  const email = gift.contributorEmail?.trim()
  if (email) {
    const hit = unique(index.byEmail, normalizeEmail(email))
    if (hit) return { guestId: hit, reason: 'email' }
  }

  // 3. Name. Try the whole signature first, then each person named in it — a gift
  // from "Morgan and Nathan Pierce" should still find Morgan.
  const typed = gift.contributorName?.trim()
  if (typed) {
    const whole = normalize(stripTitleWords(typed))
    const fullHit = unique(index.byFullName, whole)
    if (fullHit) return { guestId: fullHit, reason: 'name' }

    for (const person of splitPeople(typed)) {
      const key = normalize(stripTitleWords(person))
      if (!key) continue
      const personHit = unique(index.byFullName, key)
      if (personHit) return { guestId: personHit, reason: 'name' }
    }

    // Last resort: a first name on its own ("Aunt Marilyn" -> "marilyn"), and only
    // when exactly one guest in the whole list answers to it.
    for (const person of [typed, ...splitPeople(typed)]) {
      const key = normalize(stripTitleWords(person))
      if (!key || key.includes(' ')) continue
      const firstHit = unique(index.byFirstName, key)
      if (firstHit) return { guestId: firstHit, reason: 'name' }
    }
  }

  return { guestId: null, reason: null }
}

/**
 * Group gifts by the guest who gave them.
 *
 * Returns a map keyed by guest id. Gifts that match no guest are simply absent,
 * which is what lets the send route say "no gift on file" for that guest.
 */
export function matchGiftsToGuests<G extends GiftLike>(
  gifts: G[],
  guests: GuestLike[]
): Map<string, G[]> {
  const index = buildIndex(guests)
  const byGuest = new Map<string, G[]>()

  for (const gift of gifts) {
    const { guestId } = matchGift(gift, index)
    if (!guestId) continue
    const existing = byGuest.get(guestId)
    if (existing) existing.push(gift)
    else byGuest.set(guestId, [gift])
  }

  return byGuest
}

/** Build an index once when matching many gifts against the same guest list. */
export { buildIndex as buildGuestIndex }
export type { Index as GuestIndex }
