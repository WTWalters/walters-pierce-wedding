import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PhotosPage from '../page'

// Nicolle could not like a photo from her Android, while the same tap worked from a
// Mac. Whatever the phone was doing — a thumb landing beside a 16px emoji, a browser
// firing the handler twice, a request that never came back — one tap has to mean one
// like, and a like that does not save has to say so rather than quietly putting the
// heart back, which is indistinguishable from a tap that did nothing.

const photo = (over: Record<string, unknown> = {}) => ({
  id: 'p1', uploadedByName: 'Marilyn', caption: null,
  fileUrl: 'https://img/1.jpg', thumbnailUrl: null, createdAt: '2026-09-12T00:00:00.000Z',
  likeCount: 0, likedByMe: false, mine: false, comments: [],
  ...over,
})

type LikeReply = { ok: boolean; liked?: boolean; likeCount?: number } | 'network-error'

const mockApi = (photos: Array<Record<string, unknown>>, reply: LikeReply = { ok: true, liked: true, likeCount: 1 }) => {
  global.fetch = jest.fn((url: string) => {
    const href = String(url)
    if (href.includes('/api/auth/session')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    }
    if (href.endsWith('/like')) {
      if (reply === 'network-error') return Promise.reject(new Error('offline'))
      return Promise.resolve({ ok: reply.ok, json: () => Promise.resolve({ liked: reply.liked, likeCount: reply.likeCount }) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ photos }) })
  }) as jest.Mock
}

const calls = (suffix: string) =>
  (global.fetch as jest.Mock).mock.calls.filter(([u]) => String(u).includes(suffix))

beforeEach(() => {
  try { localStorage.clear() } catch { /* blocked storage is fine */ }
})

it('one tap likes the photo, for this device', async () => {
  mockApi([photo()])
  render(<PhotosPage />)
  await userEvent.click(await screen.findByRole('button', { name: 'Like photo' }))
  const liked = await screen.findByRole('button', { name: 'Unlike photo' })
  expect(liked).toHaveAttribute('aria-pressed', 'true')
  expect(liked).toHaveTextContent('1')
  expect(calls('/api/photos/p1/like')).toHaveLength(1)
  const body = JSON.parse(String(calls('/api/photos/p1/like')[0][1].body))
  expect(body.deviceId.length).toBeGreaterThanOrEqual(8)
})

// Some Android browsers deliver a single tap as two clicks. A state-based guard lets
// both through (React has not re-rendered between them) and the second toggles the
// first straight back off.
it('two taps before the first finishes count as one', async () => {
  mockApi([photo()])
  render(<PhotosPage />)
  const heart = await screen.findByRole('button', { name: 'Like photo' })
  fireEvent.click(heart)
  fireEvent.click(heart)
  await screen.findByRole('button', { name: 'Unlike photo' })
  expect(calls('/api/photos/p1/like')).toHaveLength(1)
})

it('a like the server refuses is put back, and says so', async () => {
  mockApi([photo()], { ok: false })
  render(<PhotosPage />)
  await userEvent.click(await screen.findByRole('button', { name: 'Like photo' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t save your like/i)
  expect(screen.getByRole('button', { name: 'Like photo' })).toHaveAttribute('aria-pressed', 'false')
})

// The old code had no catch: a request lost to a flaky venue connection left the
// heart lit and the like unsaved, gone on the next reload.
it('a like lost to the network is put back, and says so', async () => {
  mockApi([photo()], 'network-error')
  render(<PhotosPage />)
  await userEvent.click(await screen.findByRole('button', { name: 'Like photo' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t save your like/i)
  expect(screen.getByRole('button', { name: 'Like photo' })).toHaveAttribute('aria-pressed', 'false')
})

// Not refresh(): re-fetching the gallery would scroll it out from under the guest.
it('a failed like does not reload the whole gallery', async () => {
  mockApi([photo()], { ok: false })
  render(<PhotosPage />)
  await userEvent.click(await screen.findByRole('button', { name: 'Like photo' }))
  await screen.findByRole('alert')
  expect(calls('/api/photos?')).toHaveLength(1)
})

it('the message clears on the next try', async () => {
  mockApi([photo()], { ok: false })
  render(<PhotosPage />)
  await userEvent.click(await screen.findByRole('button', { name: 'Like photo' }))
  await screen.findByRole('alert')
  mockApi([photo()], { ok: true, liked: true, likeCount: 1 })
  await userEvent.click(screen.getByRole('button', { name: 'Like photo' }))
  await screen.findByRole('button', { name: 'Unlike photo' })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

// A drawn heart, not the ❤️/🤍 emoji pair: the white heart is missing from older
// Android fonts, and the two can look alike at 16px on phones that have it.
it('the heart is a real, thumb-sized button, not an emoji', async () => {
  mockApi([photo()])
  render(<PhotosPage />)
  const heart = await screen.findByRole('button', { name: 'Like photo' })
  expect(heart).toHaveAttribute('type', 'button')
  expect(heart.querySelector('svg')).not.toBeNull()
  expect(heart).not.toHaveTextContent(/[❤🤍]/u)
  expect(heart.className).toMatch(/min-h-\[44px\]/)
  expect(heart.className).toMatch(/touch-manipulation/)
})

it('shows the photo already liked from this device', async () => {
  mockApi([photo({ likedByMe: true, likeCount: 3 })])
  render(<PhotosPage />)
  const heart = await screen.findByRole('button', { name: 'Unlike photo' })
  expect(heart).toHaveAttribute('aria-pressed', 'true')
  expect(heart).toHaveTextContent('3')
  await waitFor(() => expect(heart.querySelector('svg')).toHaveAttribute('fill', '#dc2626'))
})
