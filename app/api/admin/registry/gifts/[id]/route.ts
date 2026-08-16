import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseGiftRecord } from '@/lib/gift-record'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Edit a gift Nicolle recorded by hand. Only those: she asked for it ("I don't need /
// want to edit ones that come in from the website"), and it's the safe boundary. A
// Stripe contribution's amount is tied to a real payment and was already added to its
// tier's raised total, so editing one here would put the books and the fund out of
// step with no way to tell which is right.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params

    // The source check lives in the query, so a Stripe gift can't be edited even if
    // the UI is bypassed or a stale page still shows an Edit link.
    const existing = await prisma.contribution.findFirst({ where: { id, source: 'manual' } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Only gifts you recorded by hand can be edited' },
        { status: 404 }
      )
    }

    const parsed = parseGiftRecord(await request.json().catch(() => null))
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    await prisma.contribution.update({
      where: { id },
      data: {
        contributorName: parsed.value.contributorName,
        contributorEmail: parsed.value.contributorEmail,
        giftDescription: parsed.value.giftDescription,
        amount: parsed.value.amount,
        guestId: parsed.value.guestId,
        // Left alone when she doesn't touch the date field, rather than silently
        // re-stamping the gift with today.
        ...(parsed.value.createdAt ? { createdAt: parsed.value.createdAt } : {}),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error updating a gift:', error)
    return NextResponse.json({ error: 'Failed to update the gift' }, { status: 500 })
  }
}

// Link a gift to the guest who gave it — and ONLY that. Deliberately not limited to
// hand-recorded gifts, unlike PUT and DELETE: the case Nicolle reported by name is
// the $25 that came through "Buy Me a Coffee", a Stripe gift with no Edit button at
// all. Without this she'd have no way to connect exactly the gift she asked about.
//
// The boundary PUT protects still holds, because this writes no money: a Stripe
// gift's amount stays tied to its payment and its tier's raised total. Saying who
// gave it changes nothing a guest can see.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params

    const body = await request.json().catch(() => null)
    const raw = (body as { guestId?: unknown } | null)?.guestId
    // '' and null both mean "unlink", and fall back to name/email matching.
    const guestId = raw == null || raw === '' ? null : String(raw)
    if (guestId && !UUID.test(guestId)) {
      return NextResponse.json({ error: 'That is not a guest' }, { status: 400 })
    }
    // Check the guest exists rather than letting the FK fail as a 500.
    if (guestId) {
      const guest = await prisma.guest.findUnique({ where: { id: guestId }, select: { id: true } })
      if (!guest) {
        return NextResponse.json({ error: 'That guest is no longer on the list' }, { status: 400 })
      }
    }

    const existing = await prisma.contribution.findUnique({ where: { id }, select: { id: true } })
    if (!existing) {
      return NextResponse.json({ error: 'That gift no longer exists' }, { status: 404 })
    }

    await prisma.contribution.update({ where: { id }, data: { guestId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error linking a gift to a guest:', error)
    return NextResponse.json({ error: 'Failed to link the gift' }, { status: 500 })
  }
}

// Same boundary as PUT: only gifts recorded by hand. Deleting a Stripe contribution
// would erase the record of a payment that actually happened and leave its tier's
// raised total counting money with nothing behind it.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params

    const existing = await prisma.contribution.findFirst({ where: { id, source: 'manual' } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Only gifts you recorded by hand can be deleted' },
        { status: 404 }
      )
    }

    // Keep a copy: this is the only record of the gift once the row is gone, and a
    // mis-click here is otherwise unrecoverable.
    await prisma.contribution.delete({ where: { id } })
    try {
      await prisma.auditLog.create({
        data: {
          action: 'gift_deleted',
          entityType: 'contribution',
          entityId: id,
          oldValues: {
            contributorName: existing.contributorName,
            contributorEmail: existing.contributorEmail,
            giftDescription: existing.giftDescription,
            amount: Number(existing.amount),
            createdAt: existing.createdAt.toISOString(),
          },
        },
      })
    } catch (err) {
      console.error('Audit of the deleted gift failed:', err)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting a gift:', error)
    return NextResponse.json({ error: 'Failed to delete the gift' }, { status: 500 })
  }
}
