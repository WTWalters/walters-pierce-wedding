import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GuestsPage from '../page'

// Nicolle asked for numeric fields on each guest record and for the Attending / Not
// Attending cards to break down by them. Adults under 21 are their own bucket, added
// verbally afterwards: the bar can't be quoted off a number that includes them, and
// the caterer can't be quoted off one that leaves them out.

const GUESTS = [
  {
    id: 'g1', firstName: 'Paula', lastName: 'Kuper', email: 'pm.kuper@web.de',
    source: 'imported', reviewedAt: null, createdAt: '2026-07-01T00:00:00.000Z',
    partnerFirstName: '', partnerLastName: '', preferredName: 'Paula',
    attending: true, reservedSeats: 6, rsvpdCount: 5,
    adults21Plus: 2, adultsUnder21: 1, children: 2,
  },
]

const STATS = {
  totalInvited: 10,
  rsvpReceived: 1,
  attending: 5,
  notAttending: 2,
  attendingMix: { adults21Plus: 2, adultsUnder21: 1, children: 2, unspecified: 0 },
  notAttendingMix: { adults21Plus: 0, adultsUnder21: 0, children: 0, unspecified: 2 },
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

const showCards = async () =>
  waitFor(() => expect(screen.getByText('Attending', { selector: 'div' })).toBeInTheDocument())

async function openEditModal() {
  render(<GuestsPage />)
  await waitFor(() => expect(screen.getByText('Paula Kuper')).toBeInTheDocument())
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
  await waitFor(() => expect(screen.getByText(/Edit Guest: Paula Kuper/)).toBeInTheDocument())
}

describe('the summary cards', () => {
  it('breaks Attending down into all three groups', async () => {
    render(<GuestsPage />)
    await showCards()
    expect(within(cardFor('Attending')).getByText('2 adults 21+ · 1 under 21 · 2 children'))
      .toBeInTheDocument()
  })

  // The whole reason for the third bucket: an adult under 21 must be visible as its
  // own number, never folded into the figure the bar is quoted against.
  it('keeps under-21s out of the 21+ number', async () => {
    mockFetch({
      ...STATS,
      attending: 10,
      attendingMix: { adults21Plus: 6, adultsUnder21: 4, children: 0, unspecified: 0 },
    })
    render(<GuestsPage />)
    await showCards()
    const text = within(cardFor('Attending')).getByText(/adults 21\+/).textContent
    expect(text).toContain('6 adults 21+')
    expect(text).toContain('4 under 21')
  })

  // A partial breakdown has to say so, or "8 adults 21+" reads as the finished figure.
  it('says how many are still to enter beside a partial breakdown', async () => {
    mockFetch({
      ...STATS,
      attending: 11,
      attendingMix: { adults21Plus: 8, adultsUnder21: 0, children: 0, unspecified: 3 },
    })
    render(<GuestsPage />)
    await showCards()
    expect(within(cardFor('Attending')).getByText('8 adults 21+ · 3 to enter')).toBeInTheDocument()
  })

  // With nothing broken out there is no breakdown to qualify, and the Not Attending
  // card's unclaimed seats can never be broken out at all — a "to enter" line there
  // would be a nag she has no way to clear.
  it('leaves a card bare when nothing has been broken out', async () => {
    mockFetch({
      ...STATS,
      attendingMix: { adults21Plus: 0, adultsUnder21: 0, children: 0, unspecified: 3 },
    })
    render(<GuestsPage />)
    await showCards()
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
  it('offers all three fields', async () => {
    await openEditModal()
    expect(screen.getByLabelText('Adult(s) 21+')).toBeInTheDocument()
    expect(screen.getByLabelText('Adult(s) under 21')).toBeInTheDocument()
    expect(screen.getByLabelText('Children')).toBeInTheDocument()
  })

  it('prefills them from the record', async () => {
    await openEditModal()
    expect(screen.getByLabelText('Adult(s) 21+')).toHaveValue(2)
    expect(screen.getByLabelText('Adult(s) under 21')).toHaveValue(1)
    expect(screen.getByLabelText('Children')).toHaveValue(2)
  })

  it('takes plain numbers, with no dropdown', async () => {
    await openEditModal()
    for (const label of ['Adult(s) 21+', 'Adult(s) under 21', 'Children']) {
      expect(screen.getByLabelText(label).tagName).toBe('INPUT')
      expect(screen.getByLabelText(label)).toHaveAttribute('type', 'number')
    }
  })

  // Nicolle: the number in the party IS its make-up added together.
  it("keeps Number RSVP'd equal to the sum as she types", async () => {
    await openEditModal()
    const adults = screen.getByLabelText('Adult(s) 21+')
    await userEvent.clear(adults)
    await userEvent.type(adults, '3')
    expect(screen.getByLabelText("Number RSVP'd")).toHaveValue(6) // 3 + 1 + 2
  })

  it('counts the under-21s into that sum', async () => {
    await openEditModal()
    const under21 = screen.getByLabelText('Adult(s) under 21')
    await userEvent.clear(under21)
    await userEvent.type(under21, '4')
    expect(screen.getByLabelText("Number RSVP'd")).toHaveValue(8) // 2 + 4 + 2
  })

  it('counts the children into that sum', async () => {
    await openEditModal()
    const children = screen.getByLabelText('Children')
    await userEvent.clear(children)
    await userEvent.type(children, '3')
    expect(screen.getByLabelText("Number RSVP'd")).toHaveValue(6) // 2 + 1 + 3
  })

  it("does not let Number RSVP'd be typed into a disagreement", async () => {
    await openEditModal()
    expect(screen.getByLabelText("Number RSVP'd")).toBeDisabled()
  })
})

// Nicolle: "make the columns on the Guest Management page narrower so that we can
// add ones for 21+, Under 21 and Child so at a glance I can a) determine that I've
// edited the record and b) determine that the numbers are correct."
describe('the make-up columns in the grid', () => {
  const headers = () => screen.getAllByRole('columnheader').map((h) => h.textContent?.trim())

  it('shows a column for each group', async () => {
    render(<GuestsPage />)
    await waitFor(() => expect(screen.getByText('Paula Kuper')).toBeInTheDocument())
    expect(headers()).toEqual(
      expect.arrayContaining(['21+', 'Under 21', 'Child'])
    )
  })

  // Shortened so the header wraps to two lines instead of forcing a wide column.
  it('shortens the two count headers so they can wrap', async () => {
    render(<GuestsPage />)
    await waitFor(() => expect(screen.getByText('Paula Kuper')).toBeInTheDocument())
    expect(headers()).toEqual(expect.arrayContaining(['No. in Party', 'No. RSVP’d']))
    expect(headers()).not.toEqual(expect.arrayContaining(['Number in Party']))
  })

  // Nicolle: "put No. RSVP'd next to No. in Party... then the three following
  // columns will break down the No. RSVP'd". Total first, then its parts, so the
  // check she wants — do these add up? — is one glance rightward along the row.
  it('puts the two totals together, then the three that break the second one down', async () => {
    render(<GuestsPage />)
    await waitFor(() => expect(screen.getByText('Paula Kuper')).toBeInTheDocument())
    const labels = headers()
    expect(labels.slice(labels.indexOf('No. in Party'), labels.indexOf('No. in Party') + 5))
      .toEqual(['No. in Party', 'No. RSVP’d', '21+', 'Under 21', 'Child'])
  })

  it("shows the party's numbers in its row", async () => {
    render(<GuestsPage />)
    await waitFor(() => expect(screen.getByText('Paula Kuper')).toBeInTheDocument())
    const cells = screen.getAllByRole('cell').map((c) => c.textContent?.trim())
    // No. in Party 6, then 2 / 1 / 2 across the groups, then RSVP'd 5.
    expect(cells).toEqual(expect.arrayContaining(['6', '2', '1', '5']))
  })

  // Her signal (a): an un-broken-out party leaves those three cells EMPTY. A column
  // of zeroes would look identical to a party of adults and hide the work left.
  it('leaves them blank on a party that has not been broken out', async () => {
    global.fetch = jest.fn((url: string) => {
      if (String(url).includes('/stats')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(STATS) })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          guests: [{ ...GUESTS[0], adults21Plus: null, adultsUnder21: null, children: null }],
        }),
      })
    }) as jest.Mock
    render(<GuestsPage />)
    await waitFor(() => expect(screen.getByText('Paula Kuper')).toBeInTheDocument())
    const cells = screen.getAllByRole('cell').map((c) => c.textContent?.trim())
    expect(cells).not.toEqual(expect.arrayContaining(['0']))
    expect(cells.filter((c) => c === '').length).toBeGreaterThanOrEqual(3)
  })
})
