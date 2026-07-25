import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ReviewPage from '../page'

jest.mock('@/components/admin/MessageToSend', () => ({ MessageToSend: () => null }))

const SUBMISSION = {
  id: 's1', firstName: 'Chloe', lastName: 'Hirai', email: 'c@x.com',
  attending: true, rsvpdCount: 2, dietaryRestrictions: null, songRequest: null,
  rsvpReceivedAt: '2026-07-20T00:00:00.000Z', emailLogs: [],
}

// Deliberately returned in LAST-name order, exactly like /api/admin/guests does
// (orderBy lastName, firstName) — the popup must not simply echo that order.
const GUESTS = [
  { id: 'g1', firstName: 'Matt', lastName: 'Abrams', email: 'm@x.com', reservedSeats: 2, source: 'imported' },
  { id: 'g2', firstName: 'Camden', lastName: 'Adams', email: 'c@x.com', reservedSeats: 1, source: 'imported' },
  { id: 'g3', firstName: 'Muriel', lastName: 'Addington', email: 'mu@x.com', reservedSeats: 1, source: 'imported' },
  { id: 'g4', firstName: 'Ben', lastName: 'Bright', email: 'b@x.com', reservedSeats: 4, source: 'imported' },
  { id: 'g5', firstName: 'eleanor', lastName: 'Cordi', email: 'e@x.com', reservedSeats: 1, source: 'imported' },
  // a self-RSVP row must never appear as a match target
  { id: 'g6', firstName: 'Aaron', lastName: 'Zzz', email: 'z@x.com', reservedSeats: null, source: 'self_rsvp' },
]

beforeEach(() => {
  global.fetch = jest.fn((url: string) => {
    const u = String(url)
    if (u.includes('/api/admin/review')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ submissions: [SUBMISSION] }) })
    }
    if (u.includes('/api/admin/guests')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ guests: GUESTS }) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  }) as jest.Mock
})

async function openMatchPopup() {
  render(<ReviewPage />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Match' })).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Match' }))
  await waitFor(() => expect(screen.getByText('Match to an invited guest')).toBeInTheDocument())
  // openMatch fetches /api/admin/guests asynchronously — wait for a row to render,
  // otherwise we assert against the "Loading guests…" state.
  await waitFor(() => expect(screen.getByText(/Muriel/)).toBeInTheDocument())
}

// The list reads "First Last", so ordering it by surname looked random to Nicolle.
it('sorts the match list by first name, then last name', async () => {
  await openMatchPopup()

  const names = screen
    .getAllByRole('button')
    .map((b) => b.textContent ?? '')
    .filter((t) => /@x\.com/.test(t))
    .map((t) => t.replace(/\s*\S+@x\.com\s*$/, '').trim())

  expect(names).toEqual([
    'Ben Bright',
    'Camden Adams',
    'eleanor Cordi',
    'Matt Abrams',
    'Muriel Addington',
  ])
})

it('ignores case when sorting (so "eleanor" is not banished to the end)', async () => {
  await openMatchPopup()
  const names = screen
    .getAllByRole('button')
    .map((b) => b.textContent ?? '')
    .filter((t) => /@x\.com/.test(t))
  // lowercase "eleanor" sorts between Camden and Matt, not after them
  expect(names.findIndex((n) => n.includes('eleanor')))
    .toBeLessThan(names.findIndex((n) => n.includes('Matt')))
})

it('never offers a self-RSVP row as a match target', async () => {
  await openMatchPopup()
  expect(screen.queryByText(/Aaron/)).not.toBeInTheDocument()
})
