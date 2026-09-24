import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PhotosPage from '../page'

// Whitney, 2026-09-24: "we need to be able to select pictures — and multiselect
// pictures", and "a way to download them either to the local drive or to the phone".
// And the carets beside the viewer "shift up and down when they are moused over".

const photo = (n: number, over: Record<string, unknown> = {}) => ({
  id: `p${n}`, uploadedByName: 'Marilyn', caption: `Photo ${n}`,
  fileUrl: `https://img/${n}-full.jpg`, thumbnailUrl: `https://img/${n}-thumb.jpg`,
  downloadUrl: `https://img/fl_attachment/${n}`, createdAt: '2026-09-12T00:00:00.000Z',
  likeCount: 0, likedByMe: false, mine: false, comments: [],
  ...over,
})
const three = [photo(1), photo(2), photo(3)]

type Zip = { ok: boolean; url?: string }
const mockApi = (photos = three, zip: Zip = { ok: true, url: 'https://zip/emme-and-connor.zip' }) => {
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    const href = String(url)
    if (href.includes('/api/auth/session')) return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    if (href.includes('/api/photos/download')) {
      return Promise.resolve({ ok: zip.ok, json: () => Promise.resolve({ url: zip.url, count: 2 }) })
    }
    if (href.startsWith('https://img/')) {
      return Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['jpegbytes'], { type: 'image/jpeg' })) })
    }
    if (init?.method) return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ photos }) })
  }) as jest.Mock
}
const zipRequests = () =>
  (global.fetch as jest.Mock).mock.calls
    .filter(([u]) => String(u).includes('/api/photos/download'))
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)))

// A download is a click on a throwaway link. jsdom cannot navigate, so record the
// href instead.
let saved: string[] = []
beforeEach(() => {
  saved = []
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    saved.push(this.href)
  })
  mockApi()
})
afterEach(() => {
  jest.restoreAllMocks()
  delete (navigator as unknown as { share?: unknown }).share
  delete (navigator as unknown as { canShare?: unknown }).canShare
})

const pick = (n: number) => screen.getByRole('button', { name: `Select photo: Photo ${n}` })
const startSelecting = async () => {
  render(<PhotosPage />)
  await userEvent.click(await screen.findByRole('button', { name: 'Select photos' }))
}

// app/globals.css lifts every button 1px on hover with `transform`. A caret centred
// by `-translate-y-1/2` has that transform replaced on hover and drops ~22px.
it('the viewer carets are centred without a transform, so the hover lift cannot move them', async () => {
  render(<PhotosPage />)
  await userEvent.click(await screen.findByRole('button', { name: 'View full size: Photo 2' }))
  for (const name of ['Previous photo', 'Next photo']) {
    const caret = screen.getByRole('button', { name })
    expect(caret.className).not.toMatch(/translate/)
    expect(caret.className).toMatch(/-mt-\[22px\]/)
  }
})

describe('selecting', () => {
  it('turns the thumbnails into pickers, and a tap picks rather than opens', async () => {
    await startSelecting()
    expect(pick(1)).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(pick(1))
    expect(pick(1)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('1 selected')).toBeInTheDocument()
  })

  it('picks several, and a second tap unpicks', async () => {
    await startSelecting()
    await userEvent.click(pick(1))
    await userEvent.click(pick(3))
    expect(screen.getByText('2 selected')).toBeInTheDocument()
    await userEvent.click(pick(1))
    expect(pick(1)).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('1 selected')).toBeInTheDocument()
  })

  it('has Select all and Clear', async () => {
    await startSelecting()
    await userEvent.click(screen.getByRole('button', { name: 'Select all 3' }))
    expect(screen.getByText('3 selected')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByText('0 selected')).toBeInTheDocument()
  })

  it('Done leaves the mode and forgets the picks', async () => {
    await startSelecting()
    await userEvent.click(pick(2))
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Select photos' }))
    expect(screen.getByText('0 selected')).toBeInTheDocument()
  })
})

describe('downloading', () => {
  it('cannot download nothing', async () => {
    await startSelecting()
    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled()
  })

  // One photo: its own attachment link, straight from Cloudinary — no server round trip.
  it('one photo saves its original directly', async () => {
    await startSelecting()
    await userEvent.click(pick(2))
    await userEvent.click(screen.getByRole('button', { name: 'Download' }))
    expect(saved).toEqual(['https://img/fl_attachment/2'])
    expect(zipRequests()).toHaveLength(0)
  })

  it('several photos come down as one zip the server prepares', async () => {
    await startSelecting()
    await userEvent.click(pick(1))
    await userEvent.click(pick(3))
    await userEvent.click(screen.getByRole('button', { name: 'Download 2 as zip' }))
    await waitFor(() => expect(saved).toEqual(['https://zip/emme-and-connor.zip']))
    expect(zipRequests()).toEqual([{ ids: ['p1', 'p3'] }])
  })

  it('says so when the zip cannot be prepared', async () => {
    mockApi(three, { ok: false })
    await startSelecting()
    await userEvent.click(pick(1))
    await userEvent.click(pick(2))
    await userEvent.click(screen.getByRole('button', { name: 'Download 2 as zip' }))
    expect(await screen.findByRole('status')).toHaveTextContent(/couldn.t prepare the download/i)
    expect(saved).toEqual([])
  })

  it('the viewer offers the photo on screen as a download', async () => {
    render(<PhotosPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'View full size: Photo 2' }))
    const link = within(screen.getByRole('dialog')).getByRole('link', { name: 'Download' })
    expect(link).toHaveAttribute('href', 'https://img/fl_attachment/2')
  })
})

// On a phone, "download" means the camera roll, and the way there is the share
// sheet's "Save Image". Offered only where the browser can share files at all.
describe('saving to a phone', () => {
  const share = jest.fn()
  const canShare = jest.fn()
  const phone = () => {
    share.mockReset().mockResolvedValue(undefined)
    canShare.mockReset().mockReturnValue(true)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true })
    Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true, writable: true })
  }

  it('is not offered where files cannot be shared', async () => {
    await startSelecting()
    expect(screen.queryByRole('button', { name: /save to phone/i })).not.toBeInTheDocument()
  })

  it('hands the picked photos to the share sheet', async () => {
    phone()
    await startSelecting()
    await userEvent.click(pick(1))
    await userEvent.click(pick(2))
    await userEvent.click(screen.getByRole('button', { name: 'Save to phone' }))
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    const { files } = share.mock.calls[0][0]
    expect(files).toHaveLength(2)
    expect(files.map((f: File) => f.name)).toEqual(['emme-connor-p1.jpg', 'emme-connor-p2.jpg'])
    expect(files[0].type).toBe('image/jpeg')
    expect(saved).toEqual([])
  })

  // The sheet may only open from a tap. If fetching outlasts the tap's permission
  // the photos are kept, and the next tap opens it with them at once.
  it('keeps the photos when the sheet refuses, so the next tap opens it', async () => {
    phone()
    share.mockRejectedValueOnce(Object.assign(new Error('gesture'), { name: 'NotAllowedError' }))
    await startSelecting()
    await userEvent.click(pick(1))
    await userEvent.click(screen.getByRole('button', { name: 'Save to phone' }))
    expect(await screen.findByRole('status')).toHaveTextContent(/once more/i)
    const fetchesBefore = (global.fetch as jest.Mock).mock.calls.length
    await userEvent.click(screen.getByRole('button', { name: 'Save to phone' }))
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2))
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(fetchesBefore) // nothing re-fetched
  })

  it('closing the sheet is not an error', async () => {
    phone()
    share.mockRejectedValueOnce(Object.assign(new Error('closed'), { name: 'AbortError' }))
    await startSelecting()
    await userEvent.click(pick(1))
    await userEvent.click(screen.getByRole('button', { name: 'Save to phone' }))
    await waitFor(() => expect(share).toHaveBeenCalled())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('the viewer can save the photo on screen', async () => {
    phone()
    render(<PhotosPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'View full size: Photo 3' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save to phone' }))
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    expect(share.mock.calls[0][0].files.map((f: File) => f.name)).toEqual(['emme-connor-p3.jpg'])
  })
})
