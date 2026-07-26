import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GuestsPage from '../page'

const GUESTS = [
  {
    id: 'g1', firstName: 'Muriel', lastName: 'Walters', email: 'm@x.com',
    source: 'imported', reviewedAt: null, createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'g2', firstName: 'Bob', lastName: 'Jones', email: 'b@x.com',
    source: 'imported', reviewedAt: null, createdAt: '2026-07-02T00:00:00.000Z',
  },
]

beforeEach(() => {
  global.fetch = jest.fn((url: string) => {
    if (String(url).includes('/stats')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ totalInvited: 2, rsvpReceived: 0, attending: 0, notAttending: 0 }),
      })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ guests: GUESTS }) })
  }) as jest.Mock
})

// Nicolle: an unfiltered "Showing 66 of 66 parties" "doesn't give info that I need".
// It should only appear when a search or filter is actually narrowing the list.
it('hides the "Showing X of Y" count when nothing is filtered', async () => {
  render(<GuestsPage />)
  await waitFor(() => expect(screen.getByText('Muriel Walters')).toBeInTheDocument())
  expect(screen.queryByText(/Showing \d+ of \d+ parties/)).not.toBeInTheDocument()
})

it('shows the count once a search narrows the list', async () => {
  render(<GuestsPage />)
  await waitFor(() => expect(screen.getByText('Muriel Walters')).toBeInTheDocument())

  await userEvent.type(
    screen.getByPlaceholderText('Search by name, email, or invitation code'),
    'Muriel'
  )

  await waitFor(() => expect(screen.getByText('Showing 1 of 2 parties')).toBeInTheDocument())
  expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument()
})
