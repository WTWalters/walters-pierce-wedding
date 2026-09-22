import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PhotosPage from '../page'

// The grid shows thumbnails. Tapping one has to open the photo full size — on a phone
// or in a browser — with a way to the next and previous photo, and an obvious way out.

const photo = (over: Record<string, unknown> = {}) => ({
  id: 'p1', uploadedByName: 'Marilyn', caption: null,
  fileUrl: 'https://img/1-full.jpg', thumbnailUrl: 'https://img/1-thumb.jpg',
  createdAt: '2026-09-12T00:00:00.000Z',
  likeCount: 0, likedByMe: false, mine: false, comments: [],
  ...over,
})

const three = [
  photo({ id: 'p1', caption: 'The first dance' }),
  photo({ id: 'p2', fileUrl: 'https://img/2-full.jpg', thumbnailUrl: 'https://img/2-thumb.jpg', uploadedByName: 'Nicolle' }),
  photo({ id: 'p3', fileUrl: 'https://img/3-full.jpg', thumbnailUrl: 'https://img/3-thumb.jpg' }),
]

const mockApi = (photos: Array<Record<string, unknown>>) => {
  global.fetch = jest.fn((url: string) => {
    if (String(url).includes('/api/auth/session')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ photos }) })
  }) as jest.Mock
}

const openFirst = async () => {
  render(<PhotosPage />)
  await userEvent.click(await screen.findByRole('button', { name: 'View full size: The first dance' }))
  return screen.getByRole('dialog', { name: 'Photo viewer' })
}
const shown = () => within(screen.getByRole('dialog')).getByRole('img')

// React reads touches off the native event, so a plain Event carrying them is enough;
// jsdom has no Touch to build a real TouchEvent from.
const swipe = (el: Element, fromX: number, toX: number) => {
  const start = new Event('touchstart', { bubbles: true })
  Object.defineProperty(start, 'touches', { value: [{ clientX: fromX }] })
  const end = new Event('touchend', { bubbles: true })
  Object.defineProperty(end, 'changedTouches', { value: [{ clientX: toX }] })
  fireEvent(el, start)
  fireEvent(el, end)
}

beforeEach(() => mockApi(three))
afterEach(() => { document.body.style.overflow = '' })

it('the grid shows the thumbnail; tapping it shows the full image', async () => {
  render(<PhotosPage />)
  const thumb = await screen.findByRole('button', { name: 'View full size: The first dance' })
  expect(within(thumb).getByRole('img')).toHaveAttribute('src', 'https://img/1-thumb.jpg')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await userEvent.click(thumb)
  expect(shown()).toHaveAttribute('src', 'https://img/1-full.jpg')
  expect(shown()).toHaveAttribute('alt', 'The first dance')
})

it('says where you are and who shared it', async () => {
  const dialog = await openFirst()
  expect(dialog).toHaveTextContent('1 / 3')
  expect(dialog).toHaveTextContent('The first dance')
  expect(dialog).toHaveTextContent('Shared by Marilyn')
})

it('closes with the close button, and puts focus back on the photo', async () => {
  await openFirst()
  const close = screen.getByRole('button', { name: 'Close' })
  expect(close).toHaveFocus()
  await userEvent.click(close)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'View full size: The first dance' })).toHaveFocus()
})

it('closes with Escape', async () => {
  await openFirst()
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

// The dark space around the photo closes; the photo itself does not, so a pinch-zoom
// or a mis-tap on it doesn't throw someone out.
it('tapping the dark area closes; tapping the photo does not', async () => {
  const dialog = await openFirst()
  await userEvent.click(shown())
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  fireEvent.click(dialog)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('the arrow keys step through the photos and stop at the ends', async () => {
  await openFirst()
  fireEvent.keyDown(window, { key: 'ArrowLeft' })
  expect(shown()).toHaveAttribute('src', 'https://img/1-full.jpg')
  fireEvent.keyDown(window, { key: 'ArrowRight' })
  expect(shown()).toHaveAttribute('src', 'https://img/2-full.jpg')
  expect(screen.getByRole('dialog')).toHaveTextContent('2 / 3')
  expect(screen.getByRole('dialog')).toHaveTextContent('Shared by Nicolle')
  fireEvent.keyDown(window, { key: 'ArrowRight' })
  fireEvent.keyDown(window, { key: 'ArrowRight' })
  expect(shown()).toHaveAttribute('src', 'https://img/3-full.jpg')
  fireEvent.keyDown(window, { key: 'ArrowLeft' })
  expect(shown()).toHaveAttribute('src', 'https://img/2-full.jpg')
})

it('has next and previous buttons, only where there is somewhere to go', async () => {
  await openFirst()
  expect(screen.queryByRole('button', { name: 'Previous photo' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Next photo' }))
  expect(shown()).toHaveAttribute('src', 'https://img/2-full.jpg')
  await userEvent.click(screen.getByRole('button', { name: 'Next photo' }))
  expect(shown()).toHaveAttribute('src', 'https://img/3-full.jpg')
  expect(screen.queryByRole('button', { name: 'Next photo' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Previous photo' }))
  expect(shown()).toHaveAttribute('src', 'https://img/2-full.jpg')
})

it('a swipe moves through the photos on a phone', async () => {
  const dialog = await openFirst()
  swipe(dialog, 300, 100) // left: next
  expect(shown()).toHaveAttribute('src', 'https://img/2-full.jpg')
  swipe(dialog, 100, 300) // right: previous
  expect(shown()).toHaveAttribute('src', 'https://img/1-full.jpg')
  swipe(dialog, 200, 190) // a tap, not a swipe
  expect(shown()).toHaveAttribute('src', 'https://img/1-full.jpg')
})

// The second finger of a pinch-zoom arrives as its own touchstart; zooming in on a
// photo must not flip to the next one.
it('a pinch-zoom is not a swipe', async () => {
  const dialog = await openFirst()
  const one = new Event('touchstart', { bubbles: true })
  Object.defineProperty(one, 'touches', { value: [{ clientX: 300, clientY: 0 }] })
  const two = new Event('touchstart', { bubbles: true })
  Object.defineProperty(two, 'touches', { value: [{ clientX: 300, clientY: 0 }, { clientX: 320, clientY: 0 }] })
  const lift = new Event('touchend', { bubbles: true })
  Object.defineProperty(lift, 'changedTouches', { value: [{ clientX: 100, clientY: 0 }] })
  fireEvent(dialog, one)
  fireEvent(dialog, two)
  fireEvent(dialog, lift)
  expect(shown()).toHaveAttribute('src', 'https://img/1-full.jpg')
})

it('a mostly-vertical drag is a scroll, not a swipe', async () => {
  const dialog = await openFirst()
  const start = new Event('touchstart', { bubbles: true })
  Object.defineProperty(start, 'touches', { value: [{ clientX: 300, clientY: 0 }] })
  const end = new Event('touchend', { bubbles: true })
  Object.defineProperty(end, 'changedTouches', { value: [{ clientX: 240, clientY: 400 }] })
  fireEvent(dialog, start)
  fireEvent(dialog, end)
  expect(shown()).toHaveAttribute('src', 'https://img/1-full.jpg')
})

it('the gallery behind it does not scroll while it is open', async () => {
  await openFirst()
  expect(document.body.style.overflow).toBe('hidden')
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(document.body.style.overflow).toBe('')
})

it('a single photo opens with nowhere to step', async () => {
  mockApi([photo({ caption: 'The first dance' })])
  await openFirst()
  expect(screen.getByRole('dialog')).toHaveTextContent('1 / 1')
  expect(screen.queryByRole('button', { name: 'Next photo' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Previous photo' })).not.toBeInTheDocument()
})
