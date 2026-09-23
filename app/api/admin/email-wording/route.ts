import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { FINAL_HEADCOUNT_DEFAULTS } from '@/lib/email-templates'

// The saved wording for the one-send email to everyone attending.
//
// It used to be seeded from FINAL_HEADCOUNT_DEFAULTS on every open, so any fix
// Nicolle made lasted exactly one send and the stale copy came straight back —
// "almost two weeks to go" and a deadline that had already passed. Keeping it here
// rather than in source means she can correct the wording herself, and it sticks,
// without waiting on a deploy. The constants stay as the original suggestion to
// reset back to.
//
// Next.js route files may only export handlers/config — keep these local.
const WORDING_KEY = 'final_headcount_email'

// Same caps as the send route's own content schema, so wording that saves here can
// never be too long for the thing that sends it.
const wordingSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  heading: z.string().trim().min(1).max(200),
  intro: z.string().trim().min(1).max(4000),
  ask: z.string().trim().min(1).max(4000),
  includeCount: z.boolean(),
  // Defaulted, not required: the wording she saved before the button existed has
  // neither key, and it must keep loading rather than fall back to the suggestion.
  photosButton: z.boolean().default(false),
  photosButtonLabel: z.string().trim().max(80).default(FINAL_HEADCOUNT_DEFAULTS.photosButtonLabel),
})

type Wording = z.infer<typeof wordingSchema>

const SUGGESTED: Wording = {
  subject: FINAL_HEADCOUNT_DEFAULTS.subject,
  heading: FINAL_HEADCOUNT_DEFAULTS.heading,
  intro: FINAL_HEADCOUNT_DEFAULTS.intro,
  ask: FINAL_HEADCOUNT_DEFAULTS.ask,
  includeCount: true,
  photosButton: false,
  photosButtonLabel: FINAL_HEADCOUNT_DEFAULTS.photosButtonLabel,
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let row = null
  try {
    row = await prisma.setting.findUnique({ where: { key: WORDING_KEY } })
  } catch (err) {
    // A lookup blip must not lock her out of sending: fall through to the
    // suggestion, which is what the form used to start from anyway.
    console.error('Reading the saved email wording failed:', err)
  }

  if (row?.value) {
    // Validated on the way out, not just in: a hand-edited or half-written row
    // should fall back to the suggestion rather than put empty boxes in front of
    // her, or worse, send blank paragraphs to 63 people.
    try {
      const parsed = wordingSchema.safeParse(JSON.parse(row.value))
      if (parsed.success) {
        return NextResponse.json({ wording: parsed.data, saved: true, suggested: SUGGESTED })
      }
    } catch {
      // Unparseable JSON — same fallback.
    }
  }
  return NextResponse.json({ wording: SUGGESTED, saved: false, suggested: SUGGESTED })
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const parsed = wordingSchema.safeParse(body)
  if (!parsed.success) {
    // Naming the empty box beats "Invalid request" when she has cleared one and is
    // looking at the form wondering what it wants.
    const field = parsed.error.issues[0]?.path.join('.') || 'wording'
    return NextResponse.json({ error: `Check the ${field} — it cannot be empty.` }, { status: 400 })
  }

  const wording = parsed.data
  await prisma.setting.upsert({
    where: { key: WORDING_KEY },
    create: {
      key: WORDING_KEY,
      value: JSON.stringify(wording),
      valueType: 'json',
      description: 'Saved wording for the one-send email to everyone attending',
    },
    update: { value: JSON.stringify(wording) },
  })
  return NextResponse.json({ ok: true, wording })
}
