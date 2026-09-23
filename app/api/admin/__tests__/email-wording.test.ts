jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}))
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/prisma', () => ({ prisma: {
  setting: { findUnique: jest.fn(), upsert: jest.fn() },
} }))

import { getServerSession } from 'next-auth'
import { GET, PUT } from '../email-wording/route'
import { prisma } from '@/lib/prisma'
import { FINAL_HEADCOUNT_DEFAULTS } from '@/lib/email-templates'

const req = (body: unknown) => ({ json: async () => body }) as never
type Res = { body: Record<string, never>; status: number }
const res = (r: unknown) => r as Res

const WORDING = {
  subject: 'Five days to go!',
  heading: 'Nearly here',
  intro: 'Our wedding is this week.',
  ask: 'Let Nicolle know if anything changes.',
  includeCount: true,
}
// What WORDING becomes once read or saved: the photos button fields it does not
// mention are filled in as off, so wording from before the button keeps working.
const STORED = { ...WORDING, photosButton: false, photosButtonLabel: FINAL_HEADCOUNT_DEFAULTS.photosButtonLabel }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'admin' } })
  ;(prisma.setting.findUnique as jest.Mock).mockResolvedValue(null)
  ;(prisma.setting.upsert as jest.Mock).mockResolvedValue({})
})

// This is the guest list's wording. Nobody but an admin touches it.
describe('access', () => {
  it.each([
    ['no session', null],
    ['a signed-in non-admin', { user: { role: 'guest' } }],
  ])('refuses %s', async (_label, session) => {
    ;(getServerSession as jest.Mock).mockResolvedValue(session)
    expect(res(await GET()).status).toBe(401)
    expect(res(await PUT(req(WORDING))).status).toBe(401)
    expect(prisma.setting.upsert).not.toHaveBeenCalled()
  })
})

describe('reading the wording', () => {
  it('returns the original suggestion when nothing has been saved', async () => {
    const body = res(await GET()).body
    expect(body.saved).toBe(false)
    expect(body.wording).toMatchObject({
      subject: FINAL_HEADCOUNT_DEFAULTS.subject,
      ask: FINAL_HEADCOUNT_DEFAULTS.ask,
    })
  })

  // The wording she saved before the button existed has neither key. It must keep
  // loading as hers — falling back to the suggestion would put "Almost two weeks
  // to go!" back in front of her.
  it('still loads wording saved before the photos button existed', async () => {
    ;(prisma.setting.findUnique as jest.Mock).mockResolvedValue({ value: JSON.stringify(WORDING) })
    const body = res(await GET()).body as unknown as { saved: boolean; wording: Record<string, unknown> }
    expect(body.saved).toBe(true)
    expect(body.wording.subject).toBe('Five days to go!')
    expect(body.wording.photosButton).toBe(false)
    expect(body.wording.photosButtonLabel).toBe(FINAL_HEADCOUNT_DEFAULTS.photosButtonLabel)
  })

  it('returns the saved wording once there is some', async () => {
    ;(prisma.setting.findUnique as jest.Mock).mockResolvedValue({ value: JSON.stringify(WORDING) })
    const body = res(await GET()).body
    expect(body.saved).toBe(true)
    expect(body.wording).toEqual(STORED)
  })

  // A half-written or hand-edited row must not put empty boxes in front of her, or
  // send blank paragraphs to the guest list.
  it.each([
    ['unparseable JSON', 'not json at all'],
    ['a row missing fields', '{"subject":"Only this"}'],
    ['a row with an empty box', JSON.stringify({ ...WORDING, ask: '   ' })],
  ])('falls back to the suggestion for %s', async (_label, value) => {
    ;(prisma.setting.findUnique as jest.Mock).mockResolvedValue({ value })
    const body = res(await GET()).body
    expect(body.saved).toBe(false)
    expect(body.wording).toMatchObject({ subject: FINAL_HEADCOUNT_DEFAULTS.subject })
  })

  // A database blip must not lock her out of sending.
  it('still answers when the lookup fails', async () => {
    ;(prisma.setting.findUnique as jest.Mock).mockRejectedValue(new Error('down'))
    const r = res(await GET())
    expect(r.status).toBe(200)
    expect(r.body.wording).toMatchObject({ subject: FINAL_HEADCOUNT_DEFAULTS.subject })
  })
})

describe('saving the wording', () => {
  it('stores it as JSON under its own key', async () => {
    expect(res(await PUT(req(WORDING))).status).toBe(200)
    const call = (prisma.setting.upsert as jest.Mock).mock.calls[0][0]
    expect(call.where).toEqual({ key: 'final_headcount_email' })
    expect(JSON.parse(call.update.value)).toEqual(STORED)
    expect(JSON.parse(call.create.value)).toEqual(STORED)
  })

  it('keeps the photos button, and its label, with the wording', async () => {
    await PUT(req({ ...WORDING, photosButton: true, photosButtonLabel: 'Add your photos!' }))
    const call = (prisma.setting.upsert as jest.Mock).mock.calls[0][0]
    const stored = JSON.parse(call.update.value)
    expect(stored.photosButton).toBe(true)
    expect(stored.photosButtonLabel).toBe('Add your photos!')
  })

  it('refuses a button label too long for a button', async () => {
    const r = res(await PUT(req({ ...WORDING, photosButton: true, photosButtonLabel: 'x'.repeat(81) })))
    expect(r.status).toBe(400)
    expect(prisma.setting.upsert).not.toHaveBeenCalled()
  })

  it('keeps the checkbox with the words — it is part of the wording', async () => {
    await PUT(req({ ...WORDING, includeCount: false }))
    const call = (prisma.setting.upsert as jest.Mock).mock.calls[0][0]
    expect(JSON.parse(call.update.value).includeCount).toBe(false)
  })

  // Saving an empty box would send an email with a blank paragraph in it.
  it.each(['subject', 'heading', 'intro', 'ask'])('refuses an empty %s, and says which', async (field) => {
    const r = res(await PUT(req({ ...WORDING, [field]: '   ' })))
    expect(r.status).toBe(400)
    expect(String(r.body.error)).toContain(field)
    expect(prisma.setting.upsert).not.toHaveBeenCalled()
  })

  it('refuses wording too long for the thing that sends it', async () => {
    const r = res(await PUT(req({ ...WORDING, ask: 'x'.repeat(4001) })))
    expect(r.status).toBe(400)
    expect(prisma.setting.upsert).not.toHaveBeenCalled()
  })

  it('refuses a body that is not JSON at all', async () => {
    const bad = { json: async () => { throw new Error('nope') } } as never
    expect(res(await PUT(bad)).status).toBe(400)
    expect(prisma.setting.upsert).not.toHaveBeenCalled()
  })
})
