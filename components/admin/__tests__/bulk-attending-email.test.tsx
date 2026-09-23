import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BulkAttendingEmail } from '../BulkAttendingEmail'

const RECIPIENTS = [
  { id: 'g1', name: 'Jean Murdock', email: 'jean@x.com', rsvpdCount: 2 },
  { id: 'g2', name: 'Sam Pratt', email: 'sam@x.com', rsvpdCount: 1 },
  { id: 'g3', name: 'No Address', email: null, rsvpdCount: 1 },
]

// The modal opens on whatever wording was saved last time, so every test needs that
// endpoint answered. `saved` lets a test start from either a saved draft or the
// original suggestion.
let savedWording: Record<string, unknown> | null = null

function mockFetch() {
  const fn = jest.fn((url: string, init?: { method?: string; body?: string }) => {
    if (typeof url === 'string' && url.includes('/api/admin/email-wording')) {
      if (init?.method === 'PUT') {
        savedWording = JSON.parse(init.body ?? '{}')
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            savedWording
              ? { wording: savedWording, saved: true }
              : {
                  wording: {
                    subject: 'A quick check on your RSVP — Emme & Connor',
                    heading: 'Almost two weeks to go!',
                    intro: 'Suggested opening.',
                    ask: 'Suggested ask.',
                    includeCount: true,
                  },
                  saved: false,
                }
          ),
      })
    }
    const body = JSON.parse(init?.body ?? '{}')
    if (body.dryRun) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            preview: { subject: body.content?.subject ?? 's', html: '<p>rendered</p>', text: 't' },
            recipients: 1,
            previewedAs: { name: 'Jean', rsvpdCount: 2 },
          }),
      })
    }
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          results: body.guestIds.map((id: string) => ({ guestId: id, email: 'x@x.com', success: true })),
        }),
    })
  })
  global.fetch = fn as unknown as typeof fetch
  return fn
}

beforeEach(() => {
  savedWording = null
  mockFetch()
})

// The form is gated on the saved wording arriving, so interacting before it lands
// finds a disabled Send and no boxes. Every test that drives the form waits here.
const formReady = () => screen.findByLabelText(/subject line/i)

// Bodies alone no longer identify a send: the wording endpoint is called with no
// body at all, which used to read as "not a dry run" and so as a real send.
type Call = [string, { method?: string; body?: string }?]
const bodiesTo = (fetchMock: jest.Mock, path: string) =>
  (fetchMock.mock.calls as Call[])
    .filter(([url]) => String(url).includes(path))
    .map(([, init]) => JSON.parse(String(init?.body ?? '{}')))
const realSends = (fetchMock: jest.Mock) =>
  bodiesTo(fetchMock, '/api/admin/rsvps/send').filter((b) => !b.dryRun)
const previews = (fetchMock: jest.Mock) =>
  bodiesTo(fetchMock, '/api/admin/rsvps/send').filter((b) => b.dryRun)

// She is about to email the whole guest list. One stray click must not do it.
it('does not send on the first click — it asks first', async () => {
  const fetchMock = mockFetch()
  render(<BulkAttendingEmail recipients={RECIPIENTS} onClose={() => {}} />)
  await formReady()

  await userEvent.click(screen.getByRole('button', { name: /review and send/i }))

  expect(await screen.findByText(/cannot be undone/i)).toBeInTheDocument()
  expect(realSends(fetchMock)).toHaveLength(0)
})

it('sends only to the guests who have an email on file', async () => {
  const fetchMock = mockFetch()
  const onSent = jest.fn()
  render(<BulkAttendingEmail recipients={RECIPIENTS} onClose={() => {}} onSent={onSent} />)
  await formReady()

  await userEvent.click(screen.getByRole('button', { name: /review and send/i }))
  await userEvent.click(screen.getByRole('button', { name: /yes, send 2/i }))

  await waitFor(() => expect(onSent).toHaveBeenCalled())
  const send = realSends(fetchMock)[0]
  expect(send.guestIds).toEqual(['g1', 'g2'])
  expect(send.template).toBe('final_headcount')
})

it('warns up front about the guest it cannot email', () => {
  render(<BulkAttendingEmail recipients={RECIPIENTS} onClose={() => {}} />)
  expect(screen.getByText(/1 has no email on file and will be skipped/i)).toBeInTheDocument()
  expect(screen.getByText(/goes to 2 parties/i)).toBeInTheDocument()
})

// The preview must come from the same renderer that sends, or she approves one
// thing and 63 people receive another.
it('previews her edits through the send endpoint', async () => {
  const fetchMock = mockFetch()
  render(<BulkAttendingEmail recipients={RECIPIENTS} onClose={() => {}} />)

  const subject = await formReady()
  await userEvent.clear(subject)
  await userEvent.type(subject, 'Two weeks!')

  await waitFor(() => {
    expect(previews(fetchMock).at(-1).content.subject).toBe('Two weeks!')
  })
})

// Whitney, 2026-09-13: "Can you allow for editing of the default text?" The boxes
// were re-seeded from the constants on every open, so a correction lasted exactly
// one send and the stale copy came back.
describe('the default wording', () => {
  it('opens on the wording saved last time, not the original', async () => {
    savedWording = {
      subject: 'Five days to go!',
      heading: 'Nearly here',
      intro: 'Our wedding is this week.',
      ask: 'Let Nicolle know if anything changes.',
      includeCount: true,
    }
    render(<BulkAttendingEmail recipients={RECIPIENTS} onClose={() => {}} />)
    expect(await screen.findByDisplayValue('Five days to go!')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Our wedding is this week.')).toBeInTheDocument()
    expect(screen.getByText(/opened on your saved wording/i)).toBeInTheDocument()
  })

  it('saves the current boxes as what opens next time', async () => {
    render(<BulkAttendingEmail recipients={RECIPIENTS} onClose={() => {}} />)
    const subject = await screen.findByDisplayValue('A quick check on your RSVP — Emme & Connor')
    await userEvent.clear(subject)
    await userEvent.type(subject, 'Five days to go!')
    await userEvent.click(screen.getByRole('button', { name: /save as the default wording/i }))
    await waitFor(() => expect(screen.getByText(/Saved/)).toBeInTheDocument())
    expect(savedWording).toMatchObject({ subject: 'Five days to go!' })
  })

  // Saving the wording must not email anybody — it is the opposite of the send.
  it('sends nothing when she saves the wording', async () => {
    const fetchMock = mockFetch()
    render(<BulkAttendingEmail recipients={RECIPIENTS} onClose={() => {}} />)
    await screen.findByDisplayValue('Suggested ask.')
    await userEvent.click(screen.getByRole('button', { name: /save as the default wording/i }))
    await waitFor(() => expect(screen.getByText(/Saved/)).toBeInTheDocument())
    expect(realSends(fetchMock)).toHaveLength(0)
  })

  // Resetting fills the boxes only. Nothing is saved until she says so, so this is
  // safe to click just to read the original wording.
  it('reset fills the boxes without changing what is saved', async () => {
    savedWording = {
      subject: 'Five days to go!', heading: 'Nearly here', intro: 'Mine.', ask: 'Mine too.',
      includeCount: true,
    }
    render(<BulkAttendingEmail recipients={RECIPIENTS} onClose={() => {}} />)
    await screen.findByDisplayValue('Five days to go!')
    await userEvent.click(screen.getByRole('button', { name: /reset to the original wording/i }))
    expect(screen.getByDisplayValue('A quick check on your RSVP — Emme & Connor')).toBeInTheDocument()
    expect(savedWording).toMatchObject({ subject: 'Five days to go!' })
  })

  // Sending before the saved wording arrives would send the original instead.
  it('will not send while the saved wording is still loading', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch
    render(<BulkAttendingEmail recipients={RECIPIENTS} onClose={() => {}} />)
    expect(screen.getByText(/loading the saved wording/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /review and send/i })).toBeDisabled()
  })

  // A failed load must not block the send; the original wording is still there.
  it('falls back to the original wording when the load fails', async () => {
    global.fetch = jest.fn((url: string) => {
      if (String(url).includes('/api/admin/email-wording')) {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ preview: { html: '<p>p</p>' }, previewedAs: null }),
      })
    }) as unknown as typeof fetch
    render(<BulkAttendingEmail recipients={RECIPIENTS} onClose={() => {}} />)
    expect(await screen.findByText(/could not load the saved wording/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /review and send/i })).toBeEnabled()
  })
})

// Nicolle, 2026-09-22: the venue had no signal on the night, so her next send asks
// everyone for their photos, and she wants "a button reminding everyone to upload".
describe('the photos button', () => {
  const buttonBox = () => screen.getByLabelText(/add a button to the photo gallery/i)

  it('is off until she ticks it, and the preview follows', async () => {
    const fetchMock = mockFetch()
    render(<BulkAttendingEmail recipients={RECIPIENTS} onClose={() => {}} />)
    await formReady()
    expect(buttonBox()).not.toBeChecked()
    await waitFor(() => expect(previews(fetchMock).at(-1).content.photosButton).toBe(false))

    await userEvent.click(buttonBox())

    await waitFor(() => {
      const last = previews(fetchMock).at(-1).content
      expect(last.photosButton).toBe(true)
      expect(last.photosButtonLabel).toBe('Share your wedding photos')
    })
  })

  it('lets her change the words on it', async () => {
    const fetchMock = mockFetch()
    render(<BulkAttendingEmail recipients={RECIPIENTS} onClose={() => {}} />)
    await formReady()
    // The text box appears only once there is a button to put text on.
    expect(screen.queryByLabelText(/button text/i)).not.toBeInTheDocument()
    await userEvent.click(buttonBox())

    const label = await screen.findByLabelText(/button text/i)
    await userEvent.clear(label)
    await userEvent.type(label, 'Add your photos!')

    await waitFor(() => expect(previews(fetchMock).at(-1).content.photosButtonLabel).toBe('Add your photos!'))
  })

  it('goes out with the send', async () => {
    const fetchMock = mockFetch()
    const onSent = jest.fn()
    render(<BulkAttendingEmail recipients={RECIPIENTS} onClose={() => {}} onSent={onSent} />)
    await formReady()
    await userEvent.click(buttonBox())
    await userEvent.click(screen.getByRole('button', { name: /review and send/i }))
    await userEvent.click(screen.getByRole('button', { name: /yes, send 2/i }))
    await waitFor(() => expect(onSent).toHaveBeenCalled())
    expect(realSends(fetchMock)[0].content).toMatchObject({ photosButton: true })
  })

  it('is saved with the wording, so it is on next time too', async () => {
    render(<BulkAttendingEmail recipients={RECIPIENTS} onClose={() => {}} />)
    await formReady()
    await userEvent.click(buttonBox())
    await userEvent.click(screen.getByRole('button', { name: /save as the default wording/i }))
    await waitFor(() => expect(screen.getByText(/Saved/)).toBeInTheDocument())
    expect(savedWording).toMatchObject({ photosButton: true, photosButtonLabel: 'Share your wedding photos' })
  })

  it('opens on, with her words, when that is what was saved', async () => {
    savedWording = {
      subject: 'Send us your photos!', heading: 'Thank you', intro: 'Mine.', ask: 'Mine too.',
      includeCount: false, photosButton: true, photosButtonLabel: 'Add your photos!',
    }
    render(<BulkAttendingEmail recipients={RECIPIENTS} onClose={() => {}} />)
    await formReady()
    expect(buttonBox()).toBeChecked()
    expect(screen.getByDisplayValue('Add your photos!')).toBeInTheDocument()
  })

  // Wording saved before the button existed has no say about it: off, as it was.
  it('opens off on wording saved before it existed', async () => {
    savedWording = { subject: 'Five days to go!', heading: 'Nearly here', intro: 'Mine.', ask: 'Mine too.', includeCount: true }
    render(<BulkAttendingEmail recipients={RECIPIENTS} onClose={() => {}} />)
    await formReady()
    expect(buttonBox()).not.toBeChecked()
  })

  it('reset turns it off, like the rest of the original wording', async () => {
    savedWording = {
      subject: 'Send us your photos!', heading: 'Thank you', intro: 'Mine.', ask: 'Mine too.',
      includeCount: false, photosButton: true, photosButtonLabel: 'Add your photos!',
    }
    render(<BulkAttendingEmail recipients={RECIPIENTS} onClose={() => {}} />)
    await formReady()
    await userEvent.click(screen.getByRole('button', { name: /reset to the original wording/i }))
    expect(buttonBox()).not.toBeChecked()
  })
})
