// How a guest is addressed in email. Nicolle sets `preferredName` per guest in Guest
// Management ("Grandma"); everything guest-facing greets through greetingName so the
// override applies everywhere at once.
export function greetingName(guest: { preferredName?: string | null; firstName?: string | null }): string {
  const preferred = (guest.preferredName ?? '').trim()
  return preferred || (guest.firstName ?? '').trim()
}

// Delimiters that join two people in one typed name. ONE capture group holding the
// whole delimiter (including its whitespace) keeps the split's even/odd invariant
// simple and lets mixed delimiters survive in their original order. A comma needs no
// surrounding whitespace; the word/symbol connectors do, so "Ann+Bo" stays one token.
const DELIMITER = /(\s*,\s*|\s+(?:and|&|\+)\s+)/i

// Words that are a title or relation rather than a given name. We keep the word after
// them, so "Aunt Sue" stays "Aunt Sue" instead of collapsing to the useless "Aunt" —
// relational naming is common with these givers (real observed values include "Dad").
const TITLE_OR_RELATION =
  /^(?:aunt|uncle|grandma|grandpa|gramma|granny|nana|papa|mom|mum|mother|dad|father|mr|mrs|ms|miss|dr|rev|pastor|the)\.?$/i

// Trailing list punctuation only — periods are left alone so initials ("J.", "Dr.")
// keep their dot.
const stripTrailingPunctuation = (word: string) => word.replace(/[,;:]+$/, '')

// The name to use for ONE person: their first word, or a title plus the word after it.
function firstNameWords(part: string): string {
  const words = part.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  if (TITLE_OR_RELATION.test(words[0]) && words[1]) {
    return `${words[0]} ${stripTrailingPunctuation(words[1])}`
  }
  return stripTrailingPunctuation(words[0])
}

// Normalize a captured delimiter's spacing: ", " for a comma, " and " / " & " / " + "
// for the word and symbol connectors.
function normalizeDelimiter(raw: string): string {
  const delimiter = raw.trim().toLowerCase()
  return delimiter === ',' ? ', ' : ` ${delimiter} `
}

// Shortens a name a giver typed at Stripe checkout by keeping each person's first
// name: "Eleanor Cordi" -> "Eleanor", "Morgan and Nathan pierce" -> "Morgan and
// Nathan", "Jill, Jose" -> "Jill, Jose", "Aunt Sue" -> "Aunt Sue", "Dad" -> "Dad".
// Used only when the giver can't be matched to a guest record — a matched guest's
// preferred name always wins, since Nicolle set it deliberately.
export function shortenTypedName(typed: string): string {
  const input = (typed ?? '').trim()
  if (!input) return input

  // Capturing split => even indices are name parts, odd indices are the delimiters.
  const rebuilt = input
    .split(DELIMITER)
    .map((part, i) => (i % 2 === 1 ? normalizeDelimiter(part) : firstNameWords(part)))
    .join('')
    .trim()

  // A dangling delimiter ("and Bob" -> "and") is never a greeting; fall back to the
  // untouched input rather than emitting one.
  const cleaned = rebuilt
    .replace(/^(?:and|&|\+|,)\s*/i, '')
    .replace(/\s*(?:and|&|\+|,)$/i, '')
    .trim()

  return cleaned || input
}
