import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GuestsPage from '../page'

// Two parties at table 1, one at table 2, one still unassigned.
const GUESTS = [
  {
    id: 'g1', firstName: 'Zach', lastName: 'Johnson', email: 'z@x.com',
    source: 'imported', reviewedAt: null, createdAt: '2026-07-01T00:00:00.000Z',
    attending: true, tableNumber: 2, reservedSeats: 2, rsvpdCount: 2,
  },
  {
    id: 'g2', firstName: 'Amy', lastName: 'Adams', email: 'a@x.com',
    source: 'imported', reviewedAt: null, createdAt: '2026-07-02T00:00:00.000Z',
    attending: true, tableNumber: 1, reservedSeats: 4, rsvpdCount: 3,
  },
  {
    id: 'g3', firstName: 'Ben', lastName: 'Bright', email: 'b@x.com',
    source: 'imported', reviewedAt: null, createdAt: '2026-07-03T00:00:00.000Z',
    attending: true, tableNumber: 1, reservedSeats: 2, rsvpdCount: 2,
  },
  {
    id: 'g4', firstName: 'Cara', lastName: 'Doe', email: 'c@x.com',
    source: 'imported', reviewedAt: null, createdAt: '2026-07-04T00:00:00.000Z',
    attending: true, tableNumber: undefined, reservedSeats: 1, rsvpdCount: 1,
  },
]

beforeEach(() => {
  global.fetch = jest.fn((url: string) => {
    if (String(url).includes('/stats')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ totalInvited: 9, rsvpReceived: 4, attending: 8, notAttending: 0 }),
      })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ guests: GUESTS }) })
  }) as jest.Mock
})

async function loadPage() {
  render(<GuestsPage />)
  await waitFor(() => expect(screen.getByText('Amy Adams')).toBeInTheDocument())
}

const sortByTable = () => userEvent.selectOptions(screen.getByLabelText('Sort By'), 'table')
const rowText = () =>
  Array.from(document.querySelectorAll('tbody tr')).map((tr) => tr.textContent?.trim() ?? '')

// Nicolle: "can you please add a column ... for Table Number"
it('shows the table number in the grid', async () => {
  await loadPage()
  const row = screen.getByText('Amy Adams').closest('tr')!
  expect(within(row).getByText('1')).toBeInTheDocument()
})

it('shows a dash for a party with no table yet', async () => {
  await loadPage()
  const row = screen.getByText('Cara Doe').closest('tr')!
  expect(within(row).getByText('—')).toBeInTheDocument()
})

// Nicolle: "can you make the table number ALSO visible when I click View?"
describe('the View popup', () => {
  it('shows the table number', async () => {
    await loadPage()
    await userEvent.click(within(screen.getByText('Amy Adams').closest('tr')!).getByText('View'))
    await waitFor(() => expect(screen.getByRole('heading', { name: /Amy Adams/ })).toBeInTheDocument())
    const modal = screen.getByRole('heading', { name: /Amy Adams/ }).closest('div')!.parentElement!
    expect(modal.textContent).toContain('Table:')
    expect(modal.textContent).toMatch(/Table:\s*1/)
  })

  // "Not yet" is the answer she's looking for as often as a number.
  it('says so when no table is assigned', async () => {
    await loadPage()
    await userEvent.click(within(screen.getByText('Cara Doe').closest('tr')!).getByText('View'))
    await waitFor(() => expect(screen.getByRole('heading', { name: /Cara Doe/ })).toBeInTheDocument())
    const modal = screen.getByRole('heading', { name: /Cara Doe/ }).closest('div')!.parentElement!
    expect(modal.textContent).toContain('Not assigned yet')
  })
})

// Her stretch ask: "a sub-header giving the table number followed by the names".
describe('sorted by table number', () => {
  it('groups parties under a sub-header per table', async () => {
    await loadPage()
    await sortByTable()
    await waitFor(() => expect(screen.getByText(/Table 1/)).toBeInTheDocument())

    const rows = rowText()
    expect(rows[0]).toContain('Table 1')
    expect(rows[1]).toContain('Amy')   // within a table, ordered by name
    expect(rows[2]).toContain('Ben')
    expect(rows[3]).toContain('Table 2')
    expect(rows[4]).toContain('Zach')
  })

  it('summarizes each table with its headcount and party count', async () => {
    await loadPage()
    await sortByTable()
    await waitFor(() => expect(screen.getByText(/Table 1/)).toBeInTheDocument())
    // Table 1 seats Amy's 3 and Ben's 2 across two parties.
    expect(rowText()[0]).toMatch(/5 people/)
    expect(rowText()[0]).toMatch(/2 parties/)
  })

  it('uses the singular for a table with one party and one person', async () => {
    await loadPage()
    await sortByTable()
    await waitFor(() => expect(screen.getByText(/No table assigned yet/)).toBeInTheDocument())
    const unassigned = rowText().find((r) => r.includes('No table assigned yet'))!
    expect(unassigned).toMatch(/1 person/)
    expect(unassigned).toMatch(/1 party/)
  })

  // She's working through them, so they belong together at the end.
  it('collects the unassigned parties last', async () => {
    await loadPage()
    await sortByTable()
    await waitFor(() => expect(screen.getByText(/No table assigned yet/)).toBeInTheDocument())
    const rows = rowText()
    expect(rows[rows.length - 2]).toContain('No table assigned yet')
    expect(rows[rows.length - 1]).toContain('Cara')
  })

  it('orders the tables ascending', async () => {
    await loadPage()
    await sortByTable()
    await waitFor(() => expect(screen.getByText(/Table 1/)).toBeInTheDocument())
    // The header's own text runs into its summary in textContent ("Table 1" +
    // "5 people…"), so match on the prefix rather than parsing a number out.
    const rows = rowText()
    const at = (label: string) => rows.findIndex((r) => r.startsWith(label))
    expect(at('Table 1')).toBeGreaterThanOrEqual(0)
    expect(at('Table 1')).toBeLessThan(at('Table 2'))
    expect(at('Table 2')).toBeLessThan(at('No table assigned yet'))
  })
})

// Nicolle's live data: sorted by NAME the table numbers interleave, which is what the
// original adjacent-row grouping could not survive. The earlier fixture in this file
// happened to be table-ordered when name-sorted, so it passed against the broken code
// — a fixture tidier than reality hid the bug.
describe('with tables interleaved in name order', () => {
  const INTERLEAVED = [
    { table: 2, first: 'Amber', last: 'Walters' },
    { table: 3, first: 'Bob', last: 'Adams' },
    { table: 2, first: 'Cara', last: 'Doe' },
    { table: 9, first: 'Dan', last: 'Ely' },
    { table: undefined, first: 'Eve', last: 'Fox' },
    { table: 3, first: 'Gabi', last: 'Cain' },
    { table: undefined, first: 'Hank', last: 'Ives' },
  ].map((g, i) => ({
    id: `x${i}`, firstName: g.first, lastName: g.last, email: `${g.first}@x.com`,
    source: 'imported', reviewedAt: null, createdAt: '2026-07-01T00:00:00.000Z',
    attending: true, tableNumber: g.table, reservedSeats: 1, rsvpdCount: 1,
  }))

  beforeEach(() => {
    global.fetch = jest.fn((url: string) => {
      if (String(url).includes('/stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ totalInvited: 7, rsvpReceived: 7, attending: 7, notAttending: 0 }),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ guests: INTERLEAVED }) })
    }) as jest.Mock
  })

  const load = async () => {
    render(<GuestsPage />)
    await waitFor(() => expect(screen.getByText('Amber Walters')).toBeInTheDocument())
  }

  it('announces each table exactly once', async () => {
    await load()
    await userEvent.selectOptions(screen.getByLabelText('Sort By'), 'table')
    await waitFor(() => expect(screen.getByText(/Table 2/)).toBeInTheDocument())

    const headers = rowText().filter((r) => /^Table \d|^No table/.test(r))
    expect(headers).toHaveLength(4) // tables 2, 3, 9 and the unassigned group
    expect(headers.filter((h) => h.startsWith('Table 2'))).toHaveLength(1)
    expect(headers.filter((h) => h.startsWith('No table'))).toHaveLength(1)
  })

  // Repeated labels meant repeated React keys, and React silently discarded the
  // sibling rows — which is why most of her parties disappeared.
  it('still renders every guest', async () => {
    await load()
    await userEvent.selectOptions(screen.getByLabelText('Sort By'), 'table')
    await waitFor(() => expect(screen.getByText(/Table 2/)).toBeInTheDocument())

    for (const g of INTERLEAVED) {
      expect(screen.getByText(`${g.firstName} ${g.lastName}`)).toBeInTheDocument()
    }
    const guestRowCount = rowText().filter((r) => !/^Table \d|^No table/.test(r)).length
    expect(guestRowCount).toBe(INTERLEAVED.length)
  })

  it('collects both members of a table together', async () => {
    await load()
    await userEvent.selectOptions(screen.getByLabelText('Sort By'), 'table')
    await waitFor(() => expect(screen.getByText(/Table 2/)).toBeInTheDocument())

    const rows = rowText()
    const at = (s: string) => rows.findIndex((r) => r.startsWith(s))
    // Amber and Cara are both table 2 and must sit under the one Table 2 header.
    expect(at('Table 2')).toBeLessThan(at('Amber'))
    expect(at('Amber')).toBeLessThan(at('Cara'))
    expect(at('Cara')).toBeLessThan(at('Table 3'))
  })

  // Her actual report: "When I switch the sorting field from Table Number back to
  // Name, it keeps the same formatting as the table number sort."
  it('returns to a plain list when she switches back to Name', async () => {
    await load()
    await userEvent.selectOptions(screen.getByLabelText('Sort By'), 'table')
    await waitFor(() => expect(screen.getByText(/Table 2/)).toBeInTheDocument())

    await userEvent.selectOptions(screen.getByLabelText('Sort By'), 'name')
    await waitFor(() => expect(screen.queryByText(/^Table 2/)).not.toBeInTheDocument())

    expect(rowText().filter((r) => /^Table \d|^No table/.test(r))).toHaveLength(0)
    expect(rowText().map((r) => r.split(' ')[0]))
      .toEqual(['Amber', 'Bob', 'Cara', 'Dan', 'Eve', 'Gabi', 'Hank'])
  })

  // The derived list must be right on the render the sort changes, not one behind.
  it('survives switching back and forth repeatedly', async () => {
    await load()
    for (let round = 0; round < 3; round++) {
      await userEvent.selectOptions(screen.getByLabelText('Sort By'), 'table')
      await waitFor(() => expect(screen.getByText(/Table 2/)).toBeInTheDocument())
      expect(rowText().filter((r) => /^Table \d|^No table/.test(r))).toHaveLength(4)

      await userEvent.selectOptions(screen.getByLabelText('Sort By'), 'name')
      await waitFor(() => expect(rowText().filter((r) => /^Table \d/.test(r))).toHaveLength(0))
      expect(rowText()).toHaveLength(INTERLEAVED.length)
    }
  })
})

// Every other sort stays a flat list — no stray sub-headers.
it('adds no sub-headers when sorting by name', async () => {
  await loadPage()
  expect(screen.queryByText(/Table 1/)).not.toBeInTheDocument()
  expect(rowText()).toHaveLength(GUESTS.length)
})
