# Preferred Name for Email Greetings — Design Spec

**Date:** 2026-07-25
**Status:** Approved (design), pending spec review
**Author:** Whitney + Claude

## Problem

Two related complaints from Nicolle (email "Thank you notes"):

1. **The registry thank-you greets people by full name.** It read *"Thank you for your honeymoon gift, Eleanor Cordi!"* — "This is weird. Can you please make sure that it's only first names?"
2. **She wants to control how each guest is addressed.** *"Add another field on the guest record on the Guest Management page where I can add the name I'd like them to be referred to on all correspondence? Because Mom got the response calling her 'Muriel' and how cool would it be to have her referred to as Grandma?"*

## Findings that shape the design

- **The gated emails already greet by first name.** `rsvp_yes`, `rsvp_no`, `rsvp_over_count`, `venue_details`, and `gracious_regrets` all pass `g.firstName` (`app/api/admin/rsvps/send/route.ts:49-54`). They are *not* the source of the "Eleanor Cordi" problem — but they are where "Muriel" comes from, so they need the preferred name.
- **The registry thank-you name is free text typed by the giver at Stripe checkout.** `Contribution` has `contributorName` / `contributorEmail` and **no relation to `Guest`** (`prisma/schema.prisma`). Real observed values: `"Eleanor Cordi"`, `"Morgan and Nathan pierce"`, `"Jill and Jose"`, `"Dad"`. Any shortening rule must survive couples.
- **The save-the-date route greets with the FULL name** — `` `${guest.firstName} ${guest.lastName}` `` (`app/api/admin/save-the-date/send/route.ts:48`). Same class of weirdness, in a second place.
- `Guest.email` is `@unique`, so a contributor→guest match by email is a single `findUnique`. RSVP intake lowercases emails, so the lookup must lowercase too.

## Decisions (confirmed with Whitney)

- **Fallback rule for unmatched givers:** drop the surname but keep couples intact.
- **Field label:** `Preferred name (emails)` — it drives **email greetings only**. The guest grid, CSV export, and seating keep **real** names so caterer/planner data stays accurate.

## Architecture

### 1. Schema — one nullable column

```prisma
preferredName String? @map("preferred_name")
```

Added to `model Guest`. Additive and nullable, so existing rows are unaffected and an unset value simply falls back to the first name. **Hand-authored migration folder** (`ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "preferred_name" TEXT;`) because the dev DB is `db push`-managed and `prisma migrate dev` would demand a reset; Railway applies it via `migrate deploy`.

### 2. New pure module — `lib/names.ts`

Two small functions, no dependencies, independently testable. Isolated in their own module because both the server routes and the Stripe webhook consume them.

**`greetingName(guest: { preferredName?: string | null; firstName: string }): string`**
Returns `preferredName` when set and non-blank, else `firstName`. A whitespace-only preferred name counts as unset (trimmed), so a stray space can't produce an empty greeting.

**`shortenTypedName(typed: string): string`**
Rule: **for each person named in the string, keep their first word.** Split on the connectors `and`, `&`, `+` (surrounded by whitespace; `and` matched case-insensitively) using a **capturing** split so the separators are retained, take the first whitespace token of each name part, then re-assemble the parts and separators **in their original order** — each separator normalized to a single space on both sides (`" and "`, `" & "`, `" + "`). Capturing the separators keeps mixed/multiple connectors correct (`"Jill & Jose and Bo Smith"` → `"Jill & Jose and Bo"`) and preserves a giver's `&` rather than rewriting it to `and`.

If shortening would yield an empty string, return the trimmed input unchanged, so the function never turns a non-empty name into nothing. (A truly empty/blank typed name is already covered upstream: the webhook defaults `contributorName` to `'A friend'`.)

| Input | Output |
|---|---|
| `Eleanor Cordi` | `Eleanor` |
| `Morgan and Nathan pierce` | `Morgan and Nathan` |
| `Jill and Jose` | `Jill and Jose` |
| `Dad` | `Dad` |

Known, accepted limitation: a two-word given name (`Mary Jo Smith`) shortens to `Mary`. Setting a preferred name on that guest is the escape hatch.

### 3. Guest Management — the new field

- A `Preferred name (emails)` text input in the **Edit Guest** modal (`app/admin/guests/page.tsx`), alongside the existing name fields.
- `PUT /api/admin/guests/[id]` persists it (`preferredName: body.preferredName || null`), matching how the route already normalizes optional strings.
- **Not** added to the Add-Guest form (YAGNI — Nicolle sets this on existing people like Mom); she can add a guest then edit.
- The grid, the View modal's real-name display, the CSV export, and seating are **unchanged**.

### 4. Greetings route through the resolver

- **Gated send route** (`app/api/admin/rsvps/send/route.ts`): all five templates take `greetingName(g)` instead of `g.firstName`; the local `GuestRow` type gains `preferredName: string | null`. (`findMany` already returns all scalars, so no query change.)
- **Save-the-date route** (`app/api/admin/save-the-date/send/route.ts`): greet with `greetingName(guest)` instead of `First Last`; add `preferredName: true` to its explicit `select`.
- **Registry thank-you** (`app/api/webhooks/stripe/route.ts`): look up `prisma.guest.findUnique({ where: { email: contributorEmail.toLowerCase() } })`. Matched → `greetingName(guest)`; unmatched (or no email) → `shortenTypedName(contributorName)`. The resolved value is passed as the template's `name`.

### 5. Deliberately unchanged

The **gift notification to Nicolle** (`generateGiftNotificationEmail`) keeps the giver's **real typed** name — she needs to know who actually gave, not "Grandma."

## Data flow

```
Nicolle sets "Grandma" on Mom's guest record (Edit modal → PUT → guests.preferred_name)

Gated / STD send → greetingName(guest) → "Hi Grandma!"

Gift lands → Stripe webhook
   → findUnique(guest by lowercased contributor email)
       matched   → greetingName(guest)      → "Thank you ... Grandma!"
       unmatched → shortenTypedName(typed)  → "Thank you ... Eleanor!"
   → (gift heads-up to Nicolle still says the real typed name)
```

## Error handling / edge cases

- Blank or whitespace-only `preferredName` → treated as unset, falls back to `firstName`.
- Contributor email absent or matching no guest → `shortenTypedName` fallback; no throw.
- The guest lookup lives inside the webhook's existing `try/catch`, so a lookup failure cannot lose the contribution record (the DB row is written before the emails are sent).
- Emails already delivered are frozen — this changes **future** sends only. Eleanor's existing thank-you is unaffected.

## Testing

- **`shortenTypedName`** (unit): each of Nicolle's four real examples; a blank/whitespace input returns safely; `&` and `+` connectors behave like `and`.
- **`greetingName`** (unit): preferred name wins; whitespace-only preferred name falls back to first name; missing preferred name falls back.
- **Gated send route**: a guest with `preferredName` set is greeted by it, not by `firstName`.
- **Stripe webhook**: matched guest → greeted with the preferred name; unmatched contributor → greeted with the shortened typed name; the gift notification still carries the real typed name.
- Existing email/route tests stay green.

## Files

- `prisma/schema.prisma` + a new hand-authored migration folder.
- `lib/names.ts` (**new**) + `lib/__tests__/names.test.ts` (**new**).
- `app/admin/guests/page.tsx` — Edit-modal field.
- `app/api/admin/guests/[id]/route.ts` — persist `preferredName`.
- `app/api/admin/rsvps/send/route.ts` — five greetings + row type.
- `app/api/admin/save-the-date/send/route.ts` — greeting + `select`.
- `app/api/webhooks/stripe/route.ts` — guest lookup + resolved greeting.
- Tests: `app/api/admin/rsvps/__tests__/send-templates.test.ts`, `app/api/webhooks/__tests__/stripe-route.test.ts`.

## Out of scope (YAGNI)

- Showing the preferred name in the guest grid, CSV export, or seating.
- Preferred name on the Add-Guest form.
- Retroactively re-sending or rewriting already-delivered emails.
- Linking `Contribution` to `Guest` with a real foreign key (the email lookup is sufficient and avoids a data backfill).
