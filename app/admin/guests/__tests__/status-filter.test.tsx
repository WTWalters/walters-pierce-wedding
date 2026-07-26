import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GuestsPage from '../page'

// The distinction that matters: rsvpReceivedAt is stamped only by the public RSVP
// form (lib/rsvp.ts). When Nicolle answers for a guest by editing the record, the
// PUT route sets `attending` and leaves rsvpReceivedAt null — so a filter keyed on
// rsvpReceivedAt hid exactly the guests she had handled herself.
const GUESTS = [
  {
    id: 'g1', firstName: 'Gabi', lastName: 'Cain', email: 'g@x.com',
    source: 'imported', reviewedAt: null, createdAt: '2026-07-01T00:00:00.000Z',
    attending: true, rsvpReceivedAt: '2026-07-20T00:00:00.000Z', invitationSentAt: null,
  },
  {
    // Nicolle RSVP'd for them: an answer, but no rsvpReceivedAt.
    id: 'g2', firstName: 'Ben', lastName: 'Bright', email: 'b@x.com',
    source: 'imported', reviewedAt: null, createdAt: '2026-07-02T00:00:00.000Z',
    attending: true, rsvpReceivedAt: null, invitationSentAt: null,
  },
  {
    // A "No" she also entered by hand.
    id: 'g3', firstName: 'Marilyn', lastName: 'Hinrichs', email: 'm@x.com',
    source: 'imported', reviewedAt: null, createdAt: '2026-07-03T00:00:00.000Z',
    attending: false, rsvpReceivedAt: null, invitationSentAt: null,
  },
  {
    id: 'g4', firstName: 'Trenton', lastName: 'Burton', email: 't@x.com',
    source: 'imported', reviewedAt: null, createdAt: '2026-07-04T00:00:00.000Z',
    attending: null, rsvpReceivedAt: null, invitationSentAt: null,
  },
]

beforeEach(() => {
  global.fetch = jest.fn((url: string) => {
    if (String(url).includes('/stats')) {
      return Promise.resolve({
        ok: true,
        // Matches how /api/admin/guests/stats counts: attending true + false.
        json: () => Promise.resolve({ totalInvited: 4, rsvpReceived: 3, attending: 2, notAttending: 1 }),
      })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ guests: GUESTS }) })
  }) as jest.Mock
})

async function filterBy(label: string) {
  render(<GuestsPage />)
  await waitFor(() => expect(screen.getByText('Gabi Cain')).toBeInTheDocument())
  await userEvent.selectOptions(screen.getByLabelText('Status Filter'), label)
}

const shown = (name: string) => Boolean(screen.queryByText(name))

// Nicolle: "RSVPs Received should be showing everyone we have a response for
// (even if I RSVP'd for someone)".
it('counts a response Nicolle entered herself as an RSVP received', async () => {
  await filterBy('responded')
  await waitFor(() => expect(shown('Trenton Burton')).toBe(false))
  expect(shown('Gabi Cain')).toBe(true)       // came in through the form
  expect(shown('Ben Bright')).toBe(true)      // she answered for them
  expect(shown('Marilyn Hinrichs')).toBe(true) // a hand-entered "No"
})

// It was returning nothing at all: it required invitationSentAt, which only the
// save-the-date senders ever set, and the invitations went out on paper.
it('shows the guests with no answer under No Response', async () => {
  await filterBy('no_response')
  await waitFor(() => expect(shown('Gabi Cain')).toBe(false))
  expect(shown('Trenton Burton')).toBe(true)
  expect(shown('Ben Bright')).toBe(false)
  expect(shown('Marilyn Hinrichs')).toBe(false)
})

// Responded and No Response have to partition the list — no guest in both, none in
// neither, which is what a stale invitationSentAt test broke.
it('splits the whole list between Responded and No Response', async () => {
  await filterBy('responded')
  await waitFor(() => expect(screen.getByText(/Showing 3 of 4 parties/)).toBeInTheDocument())
  await userEvent.selectOptions(screen.getByLabelText('Status Filter'), 'no_response')
  await waitFor(() => expect(screen.getByText(/Showing 1 of 4 parties/)).toBeInTheDocument())
})

// The filter must agree with the "RSVPs Received" stat card, which counts
// attending true + false. Them disagreeing is what caught Nicolle's eye.
it('agrees with the RSVPs Received stat card', async () => {
  await filterBy('responded')
  await waitFor(() => expect(screen.getByText(/Showing 3 of 4 parties/)).toBeInTheDocument())
  // "RSVPs Received" is both the stat-card caption and a filter option — take the
  // caption, then read the number sitting beside it in the card.
  const caption = screen.getAllByText('RSVPs Received').find((el) => el.tagName !== 'OPTION')
  expect(caption?.parentElement?.textContent).toContain('3')
})

// Whitney: "she filled in some of these and they don't show up in the list with
// attending — did we address that?" The Attending filter reads `attending`, so a
// response she entered by hand has always qualified; this pins it.
it('includes hand-entered responses under the Attending filter', async () => {
  await filterBy('attending')
  await waitFor(() => expect(shown('Marilyn Hinrichs')).toBe(false))
  expect(shown('Ben Bright')).toBe(true) // she answered for them, no rsvpReceivedAt
  expect(shown('Gabi Cain')).toBe(true)
  expect(shown('Trenton Burton')).toBe(false)
})

it('badges a hand-entered response as Attending, not No Response', async () => {
  render(<GuestsPage />)
  await waitFor(() => expect(screen.getByText('Ben Bright')).toBeInTheDocument())
  const row = screen.getByText('Ben Bright').closest('tr')
  expect(row?.textContent).toContain('Attending')
  expect(row?.textContent).not.toContain('No Response')
})

// Nicolle: "Pending and No Response should be the same" — one wording, and the
// badge must agree with the filter that selects the same guests.
it('badges a guest with no answer as No Response, never Pending', async () => {
  render(<GuestsPage />)
  await waitFor(() => expect(screen.getByText('Trenton Burton')).toBeInTheDocument())
  const row = screen.getByText('Trenton Burton').closest('tr')
  expect(row?.textContent).toContain('No Response')
  expect(screen.queryByText(/Pending/)).not.toBeInTheDocument()
})

// Nicolle: 'Get rid of "Invited" (doesn't return any results anyway)'.
it('no longer offers the Invited filter', async () => {
  render(<GuestsPage />)
  await waitFor(() => expect(screen.getByText('Gabi Cain')).toBeInTheDocument())
  const options = Array.from(screen.getByLabelText('Status Filter').querySelectorAll('option'))
    .map((o) => o.textContent)
  expect(options).toEqual(['All Guests', 'RSVPs Received', 'Attending', 'Not Attending', 'No Response'])
})
