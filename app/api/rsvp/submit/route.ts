import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { rsvpSchema, processRsvpSubmission } from '@/lib/rsvp'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const parsed = rsvpSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid submission' },
      { status: 400 }
    )
  }

  try {
    // A blocked submission returns the identical response shape on purpose:
    // the submitter must not be able to distinguish it from a saved one.
    await submitWithRaceRetry(parsed.data)
    return NextResponse.json({ ok: true, attending: parsed.data.attending })
  } catch (error) {
    console.error('RSVP submission failed:', error)
    return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 })
  }
}

// A double-POST race can hit the create path twice; the loser throws P2002.
// One retry lands on the update path and succeeds.
async function submitWithRaceRetry(data: Parameters<typeof processRsvpSubmission>[0]) {
  try {
    return await processRsvpSubmission(data)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return await processRsvpSubmission(data)
    }
    throw error
  }
}
