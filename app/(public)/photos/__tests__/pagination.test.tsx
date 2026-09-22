import { render, screen, within, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PhotosPage from '../page'

// The gallery used to show the newest 200 and stop. Nicolle's email will bring the
// photos from a hundred phones home; the page has to keep going, a page at a time,
// without moving the photos someone is already looking at.

const photo = (n: number, over: Record<string, unknown> = {}) => ({
  id: `p${n}`, uploadedByName: 'Marilyn', caption: `Photo ${n}`,
  fileUrl: `https://img/${n}-full.jpg`, thumbnailUrl: `https://img/${n}-thumb.jpg`,
  createdAt: '2026-09-12T00:00:00.000Z',
  likeCount: 0, likedByMe: false, mine: false, comments: [],
  ...over,
})

type Page = { photos: Array<Record<string, unknown>>; nextCursor?: string | null; total?: number }
type Reply = Page | 'fail'

// Pages keyed by cursor: '' is the first request.
const mockApi = (pages: Record<string, Reply>) => {
  global.fetch = jest.fn((url: string) => {
    const href = String(url)
    if (href.includes('/api/auth/session')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    }
    const cursor = new URL(href, 'http://x').searchParams.get('cursor') ?? ''
    const page = pages[cursor]
    if (page === 'fail' || page === undefined) return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    return Promise.resolve({ ok: true, json: () => Promise.resolve(page) })
  }) as jest.Mock
}

const galleryCalls = () =>
  (global.fetch as jest.Mock).mock.calls.map(([u]) => String(u)).filter((u) => u.includes('/api/photos?'))

const thumbs = () =>
  screen.getAllByRole('button', { name: /^View full size/ }).map((b) => within(b).getByRole('img').getAttribute('src'))

const twoPages = {
  '': { photos: [photo(1), photo(2)], nextCursor: '2026-09-12T00:00:00.000Z_p2', total: 4 },
  '2026-09-12T00:00:00.000Z_p2': { photos: [photo(3), photo(4)], nextCursor: null, total: 4 },
}

it('shows the first page, says how many there are, and offers the rest', async () => {
  mockApi(twoPages)
  render(<PhotosPage />)
  expect(await screen.findByRole('button', { name: 'Load more photos' })).toBeInTheDocument()
  expect(thumbs()).toEqual(['https://img/1-thumb.jpg', 'https://img/2-thumb.jpg'])
  expect(screen.getByText('Showing 2 of 4 photos')).toBeInTheDocument()
})

it('loads the next page underneath, using the cursor it was given', async () => {
  mockApi(twoPages)
  render(<PhotosPage />)
  await userEvent.click(await screen.findByRole('button', { name: 'Load more photos' }))
  await waitFor(() => expect(thumbs()).toHaveLength(4))
  expect(thumbs()).toEqual([
    'https://img/1-thumb.jpg', 'https://img/2-thumb.jpg', 'https://img/3-thumb.jpg', 'https://img/4-thumb.jpg',
  ])
  expect(galleryCalls()[1]).toContain(`cursor=${encodeURIComponent('2026-09-12T00:00:00.000Z_p2')}`)
  expect(screen.getByText('Showing 4 of 4 photos')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Load more photos' })).not.toBeInTheDocument()
})

it('a gallery that fits in one page offers nothing more', async () => {
  mockApi({ '': { photos: [photo(1)], nextCursor: null, total: 1 } })
  render(<PhotosPage />)
  await screen.findByRole('button', { name: 'View full size: Photo 1' })
  expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
  expect(screen.getByText('Showing 1 of 1 photos')).toBeInTheDocument()
})

it('when the next page fails, says so and lets you try again', async () => {
  mockApi({ ...twoPages, '2026-09-12T00:00:00.000Z_p2': 'fail' })
  render(<PhotosPage />)
  await userEvent.click(await screen.findByRole('button', { name: 'Load more photos' }))
  const retry = await screen.findByRole('button', { name: 'Couldn’t load more — try again' })
  expect(thumbs()).toHaveLength(2)
  mockApi(twoPages)
  await userEvent.click(retry)
  await waitFor(() => expect(thumbs()).toHaveLength(4))
})

it('a page that repeats a photo does not show it twice', async () => {
  mockApi({ ...twoPages, '2026-09-12T00:00:00.000Z_p2': { photos: [photo(2), photo(3)], nextCursor: null, total: 3 } })
  render(<PhotosPage />)
  await userEvent.click(await screen.findByRole('button', { name: 'Load more photos' }))
  await waitFor(() => expect(thumbs()).toHaveLength(3))
})

// jsdom has no IntersectionObserver; stand one in that lets the test say "the bottom
// is in view" and check the page asks for more on its own.
describe('scrolling', () => {
  let observed: IntersectionObserverCallback | null = null
  beforeEach(() => {
    observed = null
    ;(window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
      constructor(cb: IntersectionObserverCallback) { observed = cb }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
  })
  afterEach(() => {
    delete (window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver
  })

  it('nearing the bottom loads the next page without a tap', async () => {
    mockApi(twoPages)
    render(<PhotosPage />)
    await screen.findByRole('button', { name: 'Load more photos' })
    await waitFor(() => expect(observed).not.toBeNull())
    await act(async () => {
      observed!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    })
    await waitFor(() => expect(thumbs()).toHaveLength(4))
  })
})

describe('the viewer across pages', () => {
  it('counts against the whole gallery, not just what is loaded', async () => {
    mockApi(twoPages)
    render(<PhotosPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'View full size: Photo 1' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('1 / 4')
  })

  it('steps from the last loaded photo onto the next page', async () => {
    mockApi(twoPages)
    render(<PhotosPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'View full size: Photo 2' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('2 / 4')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Next photo' }))
    await waitFor(() => expect(within(dialog).getByRole('img')).toHaveAttribute('src', 'https://img/3-full.jpg'))
    expect(dialog).toHaveTextContent('3 / 4')
  })

  it('has no next on the last photo of a gallery that is all loaded', async () => {
    mockApi({ '': { photos: [photo(1), photo(2)], nextCursor: null, total: 2 } })
    render(<PhotosPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'View full size: Photo 2' }))
    expect(screen.queryByRole('button', { name: 'Next photo' })).not.toBeInTheDocument()
  })
})

// The response before paging was just { photos }. Nothing should break on it.
it('still works on a response with no paging fields', async () => {
  mockApi({ '': { photos: [photo(1), photo(2)] } })
  render(<PhotosPage />)
  await screen.findByRole('button', { name: 'View full size: Photo 1' })
  expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
  expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'View full size: Photo 1' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('1 / 2')
})
