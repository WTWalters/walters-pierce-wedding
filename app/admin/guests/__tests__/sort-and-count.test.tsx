import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GuestsPage from '../page'

// Two dated responses and three undated ones. The undated group is what Nicolle
// creates every time she answers for a guest by editing the record.
const GUESTS = [
  {
    id: 'g1', firstName: 'Zach', lastName: 'Johnson', email: 'z@x.com',
    source: 'imported', reviewedAt: null, createdAt: '2026-07-01T00:00:00.000Z',
    attending: true, rsvpReceivedAt: '2026-07-10T00:00:00.000Z',
  },
  {
    id: 'g2', firstName: 'Amy', lastName: 'Adams', email: 'a@x.com',
    source: 'imported', reviewedAt: null, createdAt: '2026-07-02T00:00:00.000Z',
    attending: true, rsvpReceivedAt: '2026-07-20T00:00:00.000Z',
  },
  {
    id: 'g3', firstName: 'Ben', lastName: 'Bright', email: 'b@x.com',
    source: 'imported', reviewedAt: null, createdAt: '2026-07-03T00:00:00.000Z',
    attending: true, rsvpReceivedAt: null,
  },
  {
    id: 'g4', firstName: 'Cara', lastName: 'Doe', email: 'c@x.com',
    source: 'imported', reviewedAt: null, createdAt: '2026-07-04T00:00:00.000Z',
    attending: false, rsvpReceivedAt: null,
  },
  {
    id: 'g5', firstName: 'Abe', lastName: 'Early', email: 'e@x.com',
    source: 'imported', reviewedAt: null, createdAt: '2026-07-05T00:00:00.000Z',
    attending: null, rsvpReceivedAt: null,
  },
]

beforeEach(() => {
  global.fetch = jest.fn((url: string) => {
    if (String(url).includes('/stats')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ totalInvited: 9, rsvpReceived: 4, attending: 3, notAttending: 1 }),
      })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ guests: GUESTS }) })
  }) as jest.Mock
})

async function loadPage() {
  render(<GuestsPage />)
  await waitFor(() => expect(screen.getByText('Amy Adams')).toBeInTheDocument())
}

const rowOrder = () =>
  Array.from(document.querySelectorAll('tbody tr'))
    .map((tr) => tr.querySelector('td')?.textContent?.trim() ?? '')
    .filter(Boolean)

// Nicolle: 'just change the word "guests" to "parties"!' A row is one invitation —
// "Ethan & Amber Walters" is a single row holding four seats.
it('counts parties, not guests', async () => {
  await loadPage()
  await userEvent.selectOptions(screen.getByLabelText('Status Filter'), 'attending')
  await waitFor(() => expect(screen.getByText(/Showing 3 of 5 parties/)).toBeInTheDocument())
  expect(screen.queryByText(/of 5 guests/)).not.toBeInTheDocument()
})

// Nicolle: "Get rid of all options except Name and RSVP Date", then later "on the
// Sort By field, can you add Table Number?" — the durable part of the first ask is
// that Email and Date Added stay gone.
it('offers Name, RSVP Date and Table Number, and nothing else', async () => {
  await loadPage()
  const options = Array.from(screen.getByLabelText('Sort By').querySelectorAll('option'))
    .map((o) => o.textContent)
  expect(options).toEqual(['Name', 'RSVP Date', 'Table Number'])
  expect(options).not.toContain('Email')
  expect(options).not.toContain('Date Added')
})

describe('sorting by RSVP date', () => {
  it('puts the newest response first', async () => {
    await loadPage()
    await userEvent.selectOptions(screen.getByLabelText('Sort By'), 'rsvp')
    await waitFor(() => expect(rowOrder()[0]).toContain('Amy'))
    expect(rowOrder()[1]).toContain('Zach') // 7/10, older than Amy's 7/20
  })

  // The responses Nicolle entered by hand have no date. They belong after the dated
  // ones, in a predictable order rather than whatever the sort happened to leave.
  it('groups undated responses after dated ones, ordered by name', async () => {
    await loadPage()
    await userEvent.selectOptions(screen.getByLabelText('Sort By'), 'rsvp')
    await waitFor(() => expect(rowOrder()[0]).toContain('Amy'))
    expect(rowOrder().map((r) => r.split(' ')[0])).toEqual(['Amy', 'Zach', 'Abe', 'Ben', 'Cara'])
  })

  // The old comparator returned 1 for two undated rows — "a is greater than b" for
  // rows it should have called equal. A correct comparator is symmetric on equals.
  it('treats two undated rows as ordered only by name, consistently', async () => {
    await loadPage()
    await userEvent.selectOptions(screen.getByLabelText('Sort By'), 'rsvp')
    await waitFor(() => expect(rowOrder()[0]).toContain('Amy'))
    const first = rowOrder()

    // switch away and back: the same input must produce the same order
    await userEvent.selectOptions(screen.getByLabelText('Sort By'), 'name')
    await waitFor(() => expect(rowOrder()[0]).toContain('Abe'))
    await userEvent.selectOptions(screen.getByLabelText('Sort By'), 'rsvp')
    await waitFor(() => expect(rowOrder()[0]).toContain('Amy'))

    expect(rowOrder()).toEqual(first)
  })
})

it('sorts by name as a full first-then-last comparison', async () => {
  await loadPage()
  expect(rowOrder().map((r) => r.split(' ')[0])).toEqual(['Abe', 'Amy', 'Ben', 'Cara', 'Zach'])
})
