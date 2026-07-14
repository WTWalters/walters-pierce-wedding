import { getStoredName, setStoredName, getDeviceId } from '../identity'

beforeEach(() => localStorage.clear())
afterEach(() => jest.restoreAllMocks())

it('name round-trips through localStorage', () => {
  expect(getStoredName()).toBeNull()
  setStoredName('  Ann Walters  ')
  expect(getStoredName()).toBe('Ann Walters')
})

it('whitespace-only setStoredName clears the stored name', () => {
  setStoredName('Ann Walters')
  setStoredName('   ')
  expect(getStoredName()).toBeNull()
  expect(localStorage.getItem('photos.name')).toBeNull()
})

it('deviceId is generated once and stable', () => {
  const first = getDeviceId()
  expect(first).toMatch(/^[0-9a-f-]{36}$/)
  expect(getDeviceId()).toBe(first)
})

it('degrades to in-memory identity when localStorage is blocked', () => {
  // Safari/Chrome "Block all cookies" throws on any Storage access.
  const blocked = () => {
    throw new Error('blocked')
  }
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
  jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked)

  // Fresh module registry so this test gets its own module-level memory,
  // isolated from the copy the other tests imported (same pattern as
  // lib/__tests__/cloudinary.test.ts).
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fresh = require('../identity') as typeof import('../identity')

    expect(fresh.getStoredName()).toBeNull()
    fresh.setStoredName('  Ann  ')
    expect(fresh.getStoredName()).toBe('Ann')

    const first = fresh.getDeviceId()
    expect(first).toMatch(/^[0-9a-f-]{36}$/)
    expect(fresh.getDeviceId()).toBe(first)
  })
})
