import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BulkAttendingEmail } from '../BulkAttendingEmail'

const RECIPIENTS = [
  { id: 'g1', name: 'Jean Murdock', email: 'jean@x.com', rsvpdCount: 2 },
  { id: 'g2', name: 'Sam Pratt', email: 'sam@x.com', rsvpdCount: 1 },
  { id: 'g3', name: 'No Address', email: null, rsvpdCount: 1 },
]

function mockFetch() {
  const fn = jest.fn((_url: string, init?: { body?: string }) => {
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
  mockFetch()
})

// She is about to email the whole guest list. One stray click must not do it.
it('does not send on the first click — it asks first', async () => {
  const fetchMock = mockFetch()
  render(<BulkAttendingEmail recipients={RECIPIENTS} onClose={() => {}} />)

  await userEvent.click(screen.getByRole('button', { name: /review and send/i }))

  expect(await screen.findByText(/cannot be undone/i)).toBeInTheDocument()
  const sends = fetchMock.mock.calls.filter((c) => !JSON.parse(String(c[1]?.body ?? '{}')).dryRun)
  expect(sends).toHaveLength(0)
})

it('sends only to the guests who have an email on file', async () => {
  const fetchMock = mockFetch()
  const onSent = jest.fn()
  render(<BulkAttendingEmail recipients={RECIPIENTS} onClose={() => {}} onSent={onSent} />)

  await userEvent.click(screen.getByRole('button', { name: /review and send/i }))
  await userEvent.click(screen.getByRole('button', { name: /yes, send 2/i }))

  await waitFor(() => expect(onSent).toHaveBeenCalled())
  const send = fetchMock.mock.calls
    .map((c) => JSON.parse(String(c[1]?.body ?? '{}')))
    .find((b) => !b.dryRun)
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

  const subject = screen.getByLabelText(/subject line/i)
  await userEvent.clear(subject)
  await userEvent.type(subject, 'Two weeks!')

  await waitFor(() => {
    const previews = fetchMock.mock.calls
      .map((c) => JSON.parse(String(c[1]?.body ?? '{}')))
      .filter((b) => b.dryRun)
    expect(previews.at(-1).content.subject).toBe('Two weeks!')
  })
})
