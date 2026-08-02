import { render, screen, act, fireEvent } from '@testing-library/react'
import RSVPPage from '../page'

const mockRouter = { push: jest.fn() }
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }))

beforeEach(() => {
  jest.useFakeTimers()
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, attending: true }) })
  ) as jest.Mock
})
afterEach(() => jest.useRealTimers())

const fieldFor = (label: string) =>
  screen.getByText(label).parentElement!.querySelector('input')!

async function submitAsAttending() {
  render(<RSVPPage />)
  fireEvent.change(fieldFor('First name *'), { target: { value: 'Ann' } })
  fireEvent.change(fieldFor('Last name *'), { target: { value: 'Lee' } })
  fireEvent.change(fieldFor('Email *'), { target: { value: 'a@x.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Joyfully accepts' }))
  fireEvent.click(screen.getByRole('button', { name: /Send RSVP/i }))
  await act(async () => {})
}

const inboxLine = () => screen.getByText(/Watch your inbox for further information/)

// Nicolle: "People have a tendency to glance at a message and if they think they know
// what it's going to say, they don't read it." A pleasantry in front of the only
// instruction on the page invites exactly that skim.
it('drops the pleasantry ahead of the instruction', async () => {
  await submitAsAttending()
  expect(screen.queryByText(/We look forward to celebrating with you/)).not.toBeInTheDocument()
})

it('still thanks them in the heading', async () => {
  await submitAsAttending()
  expect(screen.getByText('Thank you!')).toBeInTheDocument()
})

// The site never shows the venue — this line is the whole promise that it's coming.
it('keeps the inbox instruction and emphasizes it', async () => {
  await submitAsAttending()
  const line = inboxLine()
  expect(line.textContent).toContain('the date, time, and venue are on their way')
  expect(line.className).toMatch(/font-semibold|font-bold/)
})

it('leads with the instruction rather than burying it', async () => {
  await submitAsAttending()
  const heading = screen.getByText('Thank you!')
  // Node.DOCUMENT_POSITION_FOLLOWING === 4
  expect(heading.compareDocumentPosition(inboxLine()) & 4).toBeTruthy()
  const honeymoon = screen.getByText(/honeymooning in Ireland/)
  expect(inboxLine().compareDocumentPosition(honeymoon) & 4).toBeTruthy()
})
