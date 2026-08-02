import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminRegistryPage from '../page'

// One Stripe gift and one Nicolle recorded — including her real $0.01 workaround.
const CONTRIBUTIONS = [
  {
    id: 'c1', contributorName: 'Eleanor Cordi', contributorEmail: 'eleanorcordi@gmail.com',
    tierTitle: 'Tour of the Guinness Storehouse', giftDescription: null, amount: 100,
    message: null, paymentStatus: 'paid', thankYouSent: true, source: null,
    createdAt: '2026-07-23T12:00:00.000Z',
  },
  {
    id: 'c2', contributorName: 'Marilyn Hinrichs', contributorEmail: 'mjhinrichs@msn.com',
    tierTitle: 'gorgeous cake serving set', giftDescription: 'gorgeous cake serving set',
    amount: 0.01, message: null, paymentStatus: 'recorded', thankYouSent: false,
    source: 'manual', createdAt: '2026-07-21T12:00:00.000Z',
  },
]

let putBody: Record<string, unknown> | null = null
let putUrl = ''

beforeEach(() => {
  putBody = null
  putUrl = ''
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      putUrl = String(url)
      putBody = JSON.parse(String(init.body))
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ contributions: CONTRIBUTIONS, tiers: [] }),
    })
  }) as jest.Mock
})

async function loadPage() {
  render(<AdminRegistryPage />)
  await waitFor(() => expect(screen.getByText('Marilyn Hinrichs')).toBeInTheDocument())
}

const rowOf = (name: string) => screen.getByText(name).closest('tr')!

// Nicolle: "I don't need / want to edit ones that come in from the website".
it('offers Edit only on gifts she recorded', async () => {
  await loadPage()
  expect(within(rowOf('Marilyn Hinrichs')).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  expect(within(rowOf('Eleanor Cordi')).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
})

it('prefills the form from the gift', async () => {
  await loadPage()
  await userEvent.click(within(rowOf('Marilyn Hinrichs')).getByRole('button', { name: 'Edit' }))
  await waitFor(() => expect(screen.getByText('Edit this gift')).toBeInTheDocument())

  expect(screen.getByDisplayValue('Marilyn Hinrichs')).toBeInTheDocument()
  expect(screen.getByDisplayValue('mjhinrichs@msn.com')).toBeInTheDocument()
  expect(screen.getByDisplayValue('gorgeous cake serving set')).toBeInTheDocument()
  expect(screen.getByDisplayValue('2026-07-21')).toBeInTheDocument()
})

// The whole point: undo the penny she typed to get past the old required-amount rule.
it('PUTs the cleared amount to that gift', async () => {
  await loadPage()
  await userEvent.click(within(rowOf('Marilyn Hinrichs')).getByRole('button', { name: 'Edit' }))
  await waitFor(() => expect(screen.getByText('Edit this gift')).toBeInTheDocument())

  await userEvent.clear(screen.getByDisplayValue('0.01'))
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(putUrl).toContain('/api/admin/registry/gifts/c2'))
  expect(putBody).toMatchObject({ amount: '', giftDescription: 'gorgeous cake serving set' })
})

it('shows a dash instead of a figure once the amount is gone', async () => {
  await loadPage()
  // 0.01 still shows as a figure; a 0 amount must not read as "$0".
  const zeroed = { ...CONTRIBUTIONS[1], amount: 0 }
  ;(global.fetch as jest.Mock).mockImplementation(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ contributions: [zeroed], tiers: [] }) })
  )
  render(<AdminRegistryPage />)
  await waitFor(() => expect(screen.getAllByText('Marilyn Hinrichs').length).toBeGreaterThan(0))
  expect(screen.queryByText('$0')).not.toBeInTheDocument()
})

it('goes back to adding after an edit is cancelled', async () => {
  await loadPage()
  await userEvent.click(within(rowOf('Marilyn Hinrichs')).getByRole('button', { name: 'Edit' }))
  await waitFor(() => expect(screen.getByText('Edit this gift')).toBeInTheDocument())

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  await userEvent.click(screen.getByRole('button', { name: /Add a gift/ }))

  // Fresh form, not still holding Marilyn's values.
  await waitFor(() => expect(screen.getByText('Record a gift')).toBeInTheDocument())
  expect(screen.queryByDisplayValue('Marilyn Hinrichs')).not.toBeInTheDocument()
})
