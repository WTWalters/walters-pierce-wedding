import { prisma } from './prisma'

export const BLOCKLIST_SETTING_KEY = 'rsvp_blocklist'

// Fold diacritics (é→e, ô→o), lowercase, replace every non-letter with a space, collapse runs of spaces.
// "MarciAnn" stays "marciann" (no internal split), "Marci-Ann" becomes "marci ann" —
// which is why the seeded list carries both spellings.
// Accented variants (Marcí) normalize to match their base form (marci).
export function normalizeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isBlockedName(firstName: string, lastName: string, blocklist: string[]): boolean {
  const full = normalizeName(`${firstName} ${lastName}`)
  if (!full) return false
  return blocklist.some((entry) => normalizeName(entry) === full)
}

export async function getBlocklist(): Promise<string[]> {
  const row = await prisma.setting.findUnique({ where: { key: BLOCKLIST_SETTING_KEY } })
  if (!row?.value) return []
  try {
    const parsed = JSON.parse(row.value)
    if (!Array.isArray(parsed)) {
      console.warn('rsvp_blocklist setting is not an array; blocklist disabled')
      return []
    }
    return parsed.map(String)
  } catch {
    console.warn('rsvp_blocklist setting is not valid JSON; blocklist disabled')
    return []
  }
}
