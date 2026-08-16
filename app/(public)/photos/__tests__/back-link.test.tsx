import { render, screen, waitFor } from '@testing-library/react'
import PhotosPage from '../page'

// Guests reach this page by scanning the QR on a table card, so most arrive with no
// history behind them and no site navigation around them. The way back to the rest
// of the wedding site has to be on the page itself.

beforeEach(() => {
  global.fetch = jest.fn((url: string) => {
    if (String(url).includes('/api/auth/session')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ photos: [] }) })
  }) as jest.Mock
})

const backLink = () => screen.getByRole('link', { name: /back to wedding website/i })

it('offers a way back to the wedding site', async () => {
  render(<PhotosPage />)
  await waitFor(() => expect(backLink()).toBeInTheDocument())
})

it('goes to the home page', async () => {
  render(<PhotosPage />)
  await waitFor(() => expect(backLink()).toHaveAttribute('href', '/'))
})

// Not history.back(): arriving straight from a QR scan there is nothing to go back
// to, and the gesture would either do nothing or leave the site altogether.
it('is a real link rather than a history gesture', async () => {
  render(<PhotosPage />)
  await waitFor(() => expect(backLink().tagName).toBe('A'))
})

// The arrow is decoration beside the words; a screen reader should read the label.
it('reads as a back link, arrow and all', async () => {
  render(<PhotosPage />)
  await waitFor(() => expect(backLink()).toHaveTextContent(/^\s*←?\s*Back to Wedding Website\s*$/))
})

it('is there even when the gallery fails to load', async () => {
  global.fetch = jest.fn(() => Promise.reject(new Error('offline'))) as jest.Mock
  render(<PhotosPage />)
  await waitFor(() => expect(backLink()).toBeInTheDocument())
})
