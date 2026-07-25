import { render, screen, act, fireEvent } from '@testing-library/react'
import RSVPPage from '../page'

const mockPush = jest.fn()
// Must be a STABLE reference, like Next's real useRouter — returning a fresh object
// each render would re-run the redirect effect and continuously reset the countdown.
const mockRouter = { push: mockPush }
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }))

beforeEach(() => {
  jest.useFakeTimers()
  mockPush.mockClear()
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, attending: true }) })
  ) as jest.Mock
})
afterEach(() => {
  jest.useRealTimers()
})

const fieldFor = (label: string) =>
  screen.getByText(label).parentElement!.querySelector('input')!

// Submits as an attending guest. Deliberately avoids `waitFor`, which advances fake
// timers while polling and would fire the redirect before we can assert on it.
async function submitAsAttending() {
  render(<RSVPPage />)
  fireEvent.change(fieldFor('First name *'), { target: { value: 'Ann' } })
  fireEvent.change(fieldFor('Last name *'), { target: { value: 'Lee' } })
  fireEvent.change(fieldFor('Email *'), { target: { value: 'a@x.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Joyfully accepts' }))
  fireEvent.click(screen.getByRole('button', { name: /Send RSVP/i }))
  // flush the fetch microtasks so the confirmation renders, without touching timers
  await act(async () => {})
  expect(screen.getByText('Thank you!')).toBeInTheDocument()
}

// The interpolated countdown spans several text nodes, so read the whole paragraph.
const countdownText = () =>
  screen.getByText(/Taking you to the Honeymoon Fund/).textContent!.replace(/\s+/g, ' ')

it('shows a countdown starting at 12 seconds and ticks down', async () => {
  await submitAsAttending()
  expect(countdownText()).toContain('in 12 seconds')

  act(() => { jest.advanceTimersByTime(1000) })
  expect(countdownText()).toContain('in 11 seconds')

  act(() => { jest.advanceTimersByTime(3000) })
  expect(countdownText()).toContain('in 8 seconds')
})

it('uses the singular for the final second, not "1 seconds"', async () => {
  await submitAsAttending()
  act(() => { jest.advanceTimersByTime(11000) })
  expect(countdownText()).toContain('in 1 second…')
  expect(countdownText()).not.toContain('1 seconds')
})

// The old delay was 4s — far less than the ~8-11s needed to read the message, which
// carries the critical "watch your inbox for the venue" instruction.
it('does NOT redirect at the old 4-second mark', async () => {
  await submitAsAttending()
  act(() => { jest.advanceTimersByTime(4000) })
  expect(mockPush).not.toHaveBeenCalled()
})

it('redirects to the registry once the countdown finishes', async () => {
  await submitAsAttending()
  act(() => { jest.advanceTimersByTime(11999) })
  expect(mockPush).not.toHaveBeenCalled()
  act(() => { jest.advanceTimersByTime(1) })
  expect(mockPush).toHaveBeenCalledWith('/registry')
})

it('leaves the guest a button so they never depend on the timer', async () => {
  await submitAsAttending()
  expect(screen.getByRole('link', { name: /Go to the Honeymoon Fund now/i }))
    .toHaveAttribute('href', '/registry')
})
