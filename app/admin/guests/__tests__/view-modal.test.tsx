// `within` keeps assertions on the right row — every row has its own View link.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GuestsPage from '../page'

// Jill's real case: she RSVP'd with a song request, and the View popup didn't show it.
const GUESTS = [
  {
    id: 'g1', firstName: 'Jill', lastName: 'Wooten', email: 'jaddingtonwoo10@gmail.com',
    source: 'imported', reviewedAt: null, createdAt: '2026-07-01T00:00:00.000Z',
    attending: true, rsvpReceivedAt: '2026-07-17T00:00:00.000Z',
    phone: '(805) 260-1207', addressLine1: '2685 Diamondback Dr', city: 'Berthoud', state: 'CO',
    songRequest: 'Perfect by Ed Sheeran', dietaryRestrictions: null,
  },
  {
    id: 'g2', firstName: 'Trenton', lastName: 'Burton', email: 't@x.com',
    source: 'imported', reviewedAt: null, createdAt: '2026-07-02T00:00:00.000Z',
    attending: null, rsvpReceivedAt: null, songRequest: null, dietaryRestrictions: null,
  },
]

beforeEach(() => {
  global.fetch = jest.fn((url: string) => {
    if (String(url).includes('/stats')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ totalInvited: 2, rsvpReceived: 1, attending: 1, notAttending: 0 }),
      })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ guests: GUESTS }) })
  }) as jest.Mock
})

async function openView(name: string) {
  render(<GuestsPage />)
  await waitFor(() => expect(screen.getByText(name)).toBeInTheDocument())
  const row = screen.getByText(name).closest('tr')!
  await userEvent.click(within(row).getByText('View'))
  await waitFor(() => expect(screen.getByRole('heading', { name })).toBeInTheDocument())
  return screen.getByRole('heading', { name }).closest('div')!.parentElement!
}

// Nicolle: "When I click View next to a guest name ... Jill's favorite song listed
// (aka song request) is Perfect by Ed Sheeran, but I can't see it."
it('shows the favorite song in the View popup', async () => {
  const modal = await openView('Jill Wooten')
  expect(modal.textContent).toContain('Favorite Song:')
  expect(modal.textContent).toContain('Perfect by Ed Sheeran')
})

// Same label as the Edit modal and the CSV column, so it reads as one field
// everywhere rather than "song request" in one place and "favorite song" in another.
it('labels it "Favorite Song", not "Song Request"', async () => {
  const modal = await openView('Jill Wooten')
  expect(modal.textContent).not.toContain('Song Request')
})

// Every row in this modal is conditional — an empty song must not leave a bare label.
it('omits the row entirely when there is no song', async () => {
  const modal = await openView('Trenton Burton')
  expect(modal.textContent).not.toContain('Favorite Song')
})
