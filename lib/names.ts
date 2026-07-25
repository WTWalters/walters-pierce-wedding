// How a guest is addressed in email. Nicolle sets `preferredName` per guest in Guest
// Management ("Grandma"); everything guest-facing greets through greetingName so the
// override applies everywhere at once.
export function greetingName(guest: { preferredName?: string | null; firstName: string }): string {
  const preferred = (guest.preferredName ?? '').trim()
  return preferred || (guest.firstName ?? '').trim()
}

// Connectors that join two people in one typed name. Kept as a capture group so a
// split retains them and mixed connectors survive in their original order.
const CONNECTOR_SPLIT = /\s+(and|&|\+)\s+/i

// Shortens a name a giver typed at Stripe checkout by keeping each person's FIRST
// word: "Eleanor Cordi" -> "Eleanor", "Morgan and Nathan pierce" -> "Morgan and
// Nathan", "Jill and Jose" -> "Jill and Jose", "Dad" -> "Dad". Used only when the
// giver can't be matched to a guest record (otherwise greetingName wins).
export function shortenTypedName(typed: string): string {
  const input = (typed ?? '').trim()
  if (!input) return input

  // Capturing split => even indices are name parts, odd indices are the connectors.
  const parts = input.split(CONNECTOR_SPLIT)
  const rebuilt = parts
    .map((part, i) =>
      i % 2 === 1
        ? ` ${part.toLowerCase()} `
        : (part.trim().split(/\s+/)[0] ?? '')
    )
    .join('')
    .trim()

  // Belt and braces: never turn a real name into an empty greeting.
  return rebuilt || input
}
