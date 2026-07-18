import { checkRateLimit, __resetRateLimits } from '@/lib/rate-limit'

beforeEach(() => __resetRateLimits())

it('allows up to the limit within the window', () => {
  for (let i = 0; i < 30; i++) {
    expect(checkRateLimit('1.2.3.4', 30, 60_000)).toBe(true)
  }
  expect(checkRateLimit('1.2.3.4', 30, 60_000)).toBe(false)
})

it('tracks keys independently', () => {
  for (let i = 0; i < 30; i++) checkRateLimit('a', 30, 60_000)
  expect(checkRateLimit('a', 30, 60_000)).toBe(false)
  expect(checkRateLimit('b', 30, 60_000)).toBe(true)
})

it('resets after the window elapses', () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000)
  for (let i = 0; i < 30; i++) checkRateLimit('x', 30, 60_000)
  expect(checkRateLimit('x', 30, 60_000)).toBe(false)
  now.mockReturnValue(1_000_000 + 60_001)
  expect(checkRateLimit('x', 30, 60_000)).toBe(true)
  now.mockRestore()
})
