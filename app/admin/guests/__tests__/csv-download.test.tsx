import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GuestsPage from '../page'
import { GUEST_CSV_COLUMNS, DEFAULT_GUEST_CSV_KEYS } from '@/lib/guest-csv'

const GUESTS = [
  {
    id: 'g1', firstName: 'Gabi', lastName: 'Cain', email: 'g@x.com',
    source: 'imported', reviewedAt: null, createdAt: '2026-07-01T00:00:00.000Z',
    attending: true, songRequest: 'Perfect by Ed Sheeran', preferredName: 'Gabs',
  },
  {
    id: 'g2', firstName: 'Trenton', lastName: 'Burton', email: 't@x.com',
    source: 'imported', reviewedAt: null, createdAt: '2026-07-02T00:00:00.000Z',
    attending: null, songRequest: null, preferredName: null,
  },
]

// Capture what the browser was asked to download.
let downloaded = ''
let downloadName = ''

beforeEach(() => {
  window.localStorage.clear()
  downloaded = ''
  downloadName = ''

  global.fetch = jest.fn((url: string) => {
    if (String(url).includes('/stats')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ totalInvited: 2, rsvpReceived: 1, attending: 1, notAttending: 0 }),
      })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ guests: GUESTS }) })
  }) as jest.Mock

  global.URL.createObjectURL = jest.fn((blob: Blob) => {
    // jsdom's Blob has no text() in this environment; read what was handed over.
    downloaded = (blob as unknown as { __text: string }).__text ?? ''
    return 'blob:mock'
  })
  global.URL.revokeObjectURL = jest.fn()

  // Record the Blob's contents and the filename without a real download.
  const OriginalBlob = global.Blob
  global.Blob = class extends OriginalBlob {
    __text: string
    constructor(parts: BlobPart[], options?: BlobPropertyBag) {
      super(parts, options)
      this.__text = parts.join('')
    }
  } as unknown as typeof Blob

  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloadName = this.download
  })
})

afterEach(() => jest.restoreAllMocks())

async function loadPage() {
  render(<GuestsPage />)
  await waitFor(() => expect(screen.getByText('Gabi Cain')).toBeInTheDocument())
}

// Download CSV opens the picker popup; the Download button inside it does the export.
const openPicker = () => userEvent.click(screen.getByRole('button', { name: '📥 Download CSV' }))
const confirmDownload = () => userEvent.click(screen.getByRole('button', { name: '📥 Download' }))
const download = async () => { await openPicker(); await confirmDownload() }

it('downloads the default columns', async () => {
  await loadPage()
  await download()
  const header = downloaded.split('\n')[0]
  expect(header).toContain('First Name')
  expect(header).toContain('Favorite Song')
  expect(header).not.toContain('Notes')
})

// The whole point of tying the export to the grid: what you see is what you get.
it('exports only the guests currently shown', async () => {
  await loadPage()
  await userEvent.selectOptions(screen.getByLabelText('Status Filter'), 'no_response')
  await waitFor(() => expect(screen.queryByText('Gabi Cain')).not.toBeInTheDocument())

  await download()

  expect(downloaded).toContain('Trenton')
  expect(downloaded).not.toContain('Gabi')
  expect(downloaded.trim().split('\n')).toHaveLength(2) // header + one guest
})

it('names the file after the active filter', async () => {
  await loadPage()
  await userEvent.selectOptions(screen.getByLabelText('Status Filter'), 'no_response')
  await download()
  expect(downloadName).toMatch(/^wedding-guests-no-response-\d{4}-\d{2}-\d{2}\.csv$/)
})

it('exports in the order the grid is sorted', async () => {
  await loadPage()
  await download()
  const names = downloaded.split('\n').slice(1).map((r) => r.split(',')[0])
  expect(names).toEqual(['Gabi', 'Trenton'])
})

describe('the column picker', () => {
  it('adds a column she opts into', async () => {
    await loadPage()
    await openPicker()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Reserved Seats' }))
    await confirmDownload()
    expect(downloaded.split('\n')[0]).toContain('Reserved Seats')
  })

  it('removes a column she unchecks', async () => {
    await loadPage()
    await openPicker()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Preferred Name' }))
    await confirmDownload()
    const csv = downloaded
    expect(csv.split('\n')[0]).not.toContain('Preferred Name')
    expect(csv).not.toContain('Gabs') // the value goes too, not just the heading
  })

  it('remembers the choice on the next visit', async () => {
    await loadPage()
    await openPicker()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Notes' }))

    // Actually leave and come back: unmount, then mount a fresh page so the
    // selection has to survive in localStorage rather than in component state.
    cleanup()
    expect(window.localStorage.getItem('wpw.guestCsvColumns')).toContain('notes')
    await loadPage()
    await download()
    expect(downloaded.split('\n')[0]).toContain('Notes')
  })

  it('resets to the default set', async () => {
    await loadPage()
    await openPicker()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Notes' }))
    await userEvent.click(screen.getByRole('button', { name: 'Reset to default' }))
    await confirmDownload()
    expect(downloaded.split('\n')[0]).not.toContain('Notes')
  })

  // An empty file would look like "no guests" rather than "no columns chosen".
  it('refuses to download with nothing selected', async () => {
    await loadPage()
    await openPicker()
    for (const box of screen.getAllByRole('checkbox')) {
      if ((box as HTMLInputElement).checked) await userEvent.click(box)
    }
    expect(screen.getByRole('button', { name: '📥 Download' })).toBeDisabled()
    expect(screen.getByText('Pick at least one column to download.')).toBeInTheDocument()
  })

  it('ignores a saved selection full of unknown columns', async () => {
    window.localStorage.setItem('wpw.guestCsvColumns', JSON.stringify(['partnerEmail', 'gone']))
    await loadPage()
    await download()
    // falls back to the defaults rather than producing an empty file
    expect(downloaded.split('\n')[0]).toContain('First Name')
  })
})

// Nicolle: "Instead of it being a button on the main page, can it be opened up,
// perhaps as a popup window, when I click the Download CSV button?"
describe('the popup', () => {
  it('is not on the page until she clicks Download CSV', async () => {
    await loadPage()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // the standalone Columns button is gone
    expect(screen.queryByRole('button', { name: /Columns \(/ })).not.toBeInTheDocument()
  })

  it('opens on Download CSV without downloading anything yet', async () => {
    await loadPage()
    await openPicker()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(downloaded).toBe('')
    expect(downloadName).toBe('')
  })

  it('closes itself once the file is downloaded', async () => {
    await loadPage()
    await download()
    expect(downloaded).not.toBe('')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('downloads nothing when she cancels', async () => {
    await loadPage()
    await openPicker()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(downloaded).toBe('')
  })

  // Tells her what she's about to get, since a filter narrows the file.
  it('says how many parties the file will hold', async () => {
    await loadPage()
    await openPicker()
    expect(screen.getByRole('dialog').textContent).toContain('All 2 parties')

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await userEvent.selectOptions(screen.getByLabelText('Status Filter'), 'no_response')
    await openPicker()
    expect(screen.getByRole('dialog').textContent).toContain('The 1 party currently shown')
  })

  it('shows how many columns are selected', async () => {
    await loadPage()
    await openPicker()
    // Counted off the column definitions, so adding a column doesn't fail this.
    const shown = `Columns (${DEFAULT_GUEST_CSV_KEYS.length} of ${GUEST_CSV_COLUMNS.length})`
    expect(screen.getByRole('dialog').textContent).toContain(shown)
  })
})
