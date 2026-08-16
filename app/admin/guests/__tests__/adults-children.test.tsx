import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GuestsPage from '../page'

// Nicolle asked for two numeric fields, "Adult(s)" and "Children", on each guest
// record, and for the Attending / Not Attending cards to break down by them — she
// needs a firm adult count for the caterer and the bar.

const GUESTS = [
  {
    id: 'g1', firstName: 'Paula', lastName: 'Kuper', email: 'pm.kuper@web.de',
    source: 'imported', reviewedAt: null, createdAt: '2026-07-01T00:00:00.000Z',
    partnerFirstName: '', partnerLastName: '', preferredName: 'Paula',
    attending: true, reservedSeats: 4, rsvpdCount: 3, adults: 2, children: 1,
  },
]

const STATS = {
  totalInvited: 10,
  rsvpReceived: 1,
  attending: 3,
  notAttending: 2,
  attendingMix: { adults: 2, children: 1, unspecified: 0 },
  notAttendingMix: { adults: 0, children: 0, unspecified: 2 },
}

const mockFetch = (stats: Record<string, unknown> = STATS) => {
  global.fetch = jest.fn((url: string) => {
    if (String(url).includes('/stats')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(stats) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ guests: GUESTS }) })
  }) as jest.Mock
}

beforeEach(() => mockFetch())

// "Attending" is also the text of a filter <option>, so pin the match to the card's
// own label div and step up to the card around it.
const cardFor = (label: string) =>
  screen.getByText(label, { selector: 'div' }).parentElement as HTMLElement

async function openEditModal() {
  render(<GuestsPage />)
  await waitFor(() => expect(screen.getByText('Paula Kuper')).toBeInTheDocument())
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
  await waitFor(() => expect(screen.getByText(/Edit Guest: Paula Kuper/)).toBeInTheDocument())
}

describe('the summary cards', () => {
  it('breaks Attending down into adults and children', async () => {
    render(<GuestsPage />)
    await waitFor(() => expect(screen.getByText('Attending', { selector: 'div' })).toBeInTheDocument())
    expect(within(cardFor('Attending')).getByText('2 adults · 1 child')).toBeInTheDocument()
  })

  // The one thing that must never happen: a party nobody has broken out yet
  // silently counted as adults on a number the bar is quoted against. A partial
  // breakdown has to say so, or "8 adults" reads as the finished figure.
  it('says how many are still to enter beside a partial breakdown', async () => {
    mockFetch({ ...STATS, attending: 11, attendingMix: { adults: 8, children: 0, unspecified: 3 } })
    render(<GuestsPage />)
    await waitFor(() => expect(screen.getByText('Attending', { selector: 'div' })).toBeInTheDocument())
    expect(within(cardFor('Attending')).getByText('8 adults · 3 to enter')).toBeInTheDocument()
  })

  // With nothing broken out there is no breakdown to qualify, and the Not Attending
  // card's unclaimed seats can never be broken out at all — a "to enter" line there
  // would be a nag she has no way to clear.
  it('leaves a card bare when nothing has been broken out', async () => {
    mockFetch({ ...STATS, attendingMix: { adults: 0, children: 0, unspecified: 3 } })
    render(<GuestsPage />)
    await waitFor(() => expect(screen.getByText('Attending', { selector: 'div' })).toBeInTheDocument())
    expect(within(cardFor('Attending')).queryByText(/adult|to enter/)).not.toBeInTheDocument()
  })

  // An older or cached stats response has no breakdown on it at all; the page must
  // still render rather than blanking out.
  it('survives a stats response with no breakdown', async () => {
    mockFetch({ totalInvited: 10, rsvpReceived: 1, attending: 3, notAttending: 2 })
    render(<GuestsPage />)
    await waitFor(() => expect(screen.getByText('Paula Kuper')).toBeInTheDocument())
    expect(screen.getByText('Attending', { selector: 'div' })).toBeInTheDocument()
  })
})

describe('the Edit Guest popup', () => {
  it('offers Adult(s) and Children fields', async () => {
    await openEditModal()
    expect(screen.getByLabelText('Adult(s)')).toBeInTheDocument()
    expect(screen.getByLabelText('Children')).toBeInTheDocument()
  })

  it('prefills them from the record', async () => {
    await openEditModal()
    expect(screen.getByLabelText('Adult(s)')).toHaveValue(2)
    expect(screen.getByLabelText('Children')).toHaveValue(1)
  })

  it('takes plain numbers, with no dropdown', async () => {
    await openEditModal()
    expect(screen.getByLabelText('Adult(s)').tagName).toBe('INPUT')
    expect(screen.getByLabelText('Adult(s)')).toHaveAttribute('type', 'number')
  })

  // Nicolle: the number in the party IS the adults plus the children.
  it("keeps Number RSVP'd equal to their sum as she types", async () => {
    await openEditModal()
    const adults = screen.getByLabelText('Adult(s)')
    await userEvent.clear(adults)
    await userEvent.type(adults, '3')
    expect(screen.getByLabelText("Number RSVP'd")).toHaveValue(4) // 3 adults + 1 child
  })

  it("updates the sum when the children change too", async () => {
    await openEditModal()
    const children = screen.getByLabelText('Children')
    await userEvent.clear(children)
    await userEvent.type(children, '2')
    expect(screen.getByLabelText("Number RSVP'd")).toHaveValue(4) // 2 adults + 2 children
  })

  it("does not let Number RSVP'd be typed into a disagreement", async () => {
    await openEditModal()
    expect(screen.getByLabelText("Number RSVP'd")).toBeDisabled()
  })
})
