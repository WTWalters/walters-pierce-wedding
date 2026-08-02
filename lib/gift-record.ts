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
})

export type GiftRecordFields = {
  contributorName: string
  contributorEmail: string
  giftDescription: string | null
  amount: number
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
  const { contributorName, contributorEmail, giftDescription, amount, givenOn } = parsed.data

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
      // A bare yyyy-mm-dd parses as UTC midnight, which in Denver is the evening
      // before — noon keeps the date she typed on both sides of the conversion.
      ...(givenOn ? { createdAt: new Date(`${givenOn}T12:00:00`) } : {}),
    },
  }
}
