import { z } from 'zod'

// Gifts that never touched Stripe — cash, a cheque, a physical present. Nicolle
// records them so the Gifts tab is the whole picture and she can send a thank-you.
//
// Shared by the create and edit routes so the two can't drift on what a valid gift
// is. Editing is limited to manual gifts by her request ("I don't need / want to
// edit ones that come in from the website"), which is also the safe rule: a Stripe
// contribution's amount is tied to a real payment and to a tier's raised total.
//
// Email is optional on purpose: she often won't have one for a cash gift, and making
// it required is what produced the "please-correct@your.emailaddy.com" placeholders
// on the guest list. A gift with no email simply can't be thanked by email.
export const giftRecordSchema = z.object({
  contributorName: z.string().trim().min(1, 'A name is required').max(200),
  contributorEmail: z.string().trim().max(200).optional().default(''),
  giftDescription: z.string().trim().max(500).optional().default(''),
  // Optional: a physical present has no amount, and Nicolle is right that one should
  // never be shown for it. Stored as 0 (the column is NOT NULL) and treated as "no
  // cash value" everywhere it's displayed or put into a thank-you.
  amount: z.coerce.number().min(0).max(1_000_000).optional().default(0),
  // Date only (yyyy-mm-dd) from a date input, or omitted.
  givenOn: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // The guest this gift is from, chosen on the form. Optional — a giver who isn't on
  // the guest list at all still gets recorded, and falls back to name/email matching.
  // '' from an unselected <select> means "no guest chosen", same as omitted.
  guestId: z.string().trim().uuid().optional().or(z.literal('')),
  // The second gift, for a giver like Aunt Marilyn who gave both a present and cash
  // in one go. Stored as its OWN contribution row rather than extra columns here:
  // the thank-you already names any number of gifts, and one row per gift is what
  // keeps the Gifts tab's totals and thanked-flags honest per gift.
  secondGiftDescription: z.string().trim().max(500).optional().default(''),
  secondAmount: z.coerce.number().min(0).max(1_000_000).optional().default(0),
})

export type GiftRecordFields = {
  contributorName: string
  contributorEmail: string
  giftDescription: string | null
  amount: number
  guestId: string | null
  createdAt?: Date
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Validate and normalize a gift payload into the columns to write. Returns the
 * message to show Nicolle rather than throwing, since every failure here is
 * something she can fix in the form.
 */
export function parseGiftRecord(
  body: unknown
): { ok: true; value: GiftRecordFields } | { ok: false; error: string } {
  const parsed = giftRecordSchema.safeParse(body)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }
  }
  const { contributorName, contributorEmail, giftDescription, amount, givenOn, guestId } = parsed.data

  // Neither an amount nor a description leaves a row that says nothing and a
  // thank-you that can only manage "your generous gift".
  if (amount === 0 && !giftDescription) {
    return { ok: false, error: 'Add an amount, or describe the gift' }
  }

  const email = contributorEmail.toLowerCase()
  if (email && !EMAIL.test(email)) {
    return { ok: false, error: "That email doesn't look right" }
  }

  return {
    ok: true,
    value: {
      contributorName,
      contributorEmail: email,
      giftDescription: giftDescription || null,
      amount,
      guestId: guestId || null,
      // A bare yyyy-mm-dd parses as UTC midnight, which in Denver is the evening
      // before — noon keeps the date she typed on both sides of the conversion.
      ...(givenOn ? { createdAt: new Date(`${givenOn}T12:00:00`) } : {}),
    },
  }
}

/**
 * Validate a submission from the Add-a-gift form, which may describe TWO gifts from
 * the same person — Aunt Marilyn's engraved cake serving set and her $100 toward the
 * Honeymoon Fund. Returns one record per gift, in the order she typed them, so the
 * thank-you lists them that way.
 *
 * The giver's name, email, guest link and date are shared: they're one person giving
 * on one occasion. Only the description and amount differ.
 */
export function parseGiftRecords(
  body: unknown
): { ok: true; value: GiftRecordFields[] } | { ok: false; error: string } {
  const first = parseGiftRecord(body)
  if (!first.ok) return first

  const parsed = giftRecordSchema.safeParse(body)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }
  }
  const { secondGiftDescription, secondAmount } = parsed.data

  // Both blank is the ordinary single-gift case, not an error.
  if (secondAmount === 0 && !secondGiftDescription) {
    return { ok: true, value: [first.value] }
  }

  return {
    ok: true,
    value: [
      first.value,
      { ...first.value, giftDescription: secondGiftDescription || null, amount: secondAmount },
    ],
  }
}
