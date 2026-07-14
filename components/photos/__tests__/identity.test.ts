import { getStoredName, setStoredName, getDeviceId } from '../identity'

beforeEach(() => localStorage.clear())

it('name round-trips through localStorage', () => {
  expect(getStoredName()).toBeNull()
  setStoredName('  Ann Walters  ')
  expect(getStoredName()).toBe('Ann Walters')
})

it('deviceId is generated once and stable', () => {
  const first = getDeviceId()
  expect(first).toMatch(/^[0-9a-f-]{36}$/)
  expect(getDeviceId()).toBe(first)
})
