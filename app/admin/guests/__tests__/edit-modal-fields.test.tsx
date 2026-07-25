import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GuestsPage from '../page'

const GUESTS = [
  {
    id: 'g1', firstName: 'Paula', lastName: 'Kuper', email: 'pm.kuper@web.de',
    source: 'imported', reviewedAt: null, createdAt: '2026-07-01T00:00:00.000Z',
    partnerFirstName: '', partnerLastName: '', preferredName: 'Paula',
    // Prisma returns null (not undefined) for an unanswered RSVP, and the
    // Attending <select> reads it directly — keep the fixture faithful.
    attending: null,
  },
]

beforeEach(() => {
  global.fetch = jest.fn((url: string) => {
    if (String(url).includes('/stats')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ totalInvited: 1, rsvpReceived: 0, attending: 0, notAttending: 0 }),
      })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ guests: GUESTS }) })
  }) as jest.Mock
})

async function openEditModal() {
  render(<GuestsPage />)
  await waitFor(() => expect(screen.getByText('Paula Kuper')).toBeInTheDocument())
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
  await waitFor(() => expect(screen.getByText(/Edit Guest: Paula Kuper/)).toBeInTheDocument())
}

// Nicolle: "remove Partner Email (we're not using it)".
it('no longer offers a Partner Email field', async () => {
  await openEditModal()
  expect(screen.queryByText(/Partner Email/i)).not.toBeInTheDocument()
  // the fields she kept are still there
  expect(screen.getByText('Partner First Name')).toBeInTheDocument()
  expect(screen.getByText('Partner Last Name')).toBeInTheDocument()
})

// Nicolle: 'Capitalize "Name" in "Preferred Name"'.
it('capitalizes the Preferred Name label', async () => {
  await openEditModal()
  expect(screen.getByText('Preferred Name (emails)')).toBeInTheDocument()
  expect(screen.queryByText('Preferred name (emails)')).not.toBeInTheDocument()
})

// Nicolle: put Preferred Name "to the right of Partner First Name and Partner
// Last Name (scoot those two over)" — so it must come last of the three in the
// DOM, which in the 3-column grid puts it at the end of that row.
it('orders the fields Partner First, Partner Last, then Preferred Name', async () => {
  await openEditModal()

  const labels = ['Partner First Name', 'Partner Last Name', 'Preferred Name (emails)']
    .map((text) => screen.getByText(text))

  for (let i = 1; i < labels.length; i++) {
    // Node.DOCUMENT_POSITION_FOLLOWING === 4
    expect(labels[i - 1].compareDocumentPosition(labels[i]) & 4).toBeTruthy()
  }
})
