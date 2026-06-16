import { rateLimit, _resetRateLimitStore } from '../rate-limit';

describe('rateLimit', () => {
  beforeEach(() => _resetRateLimitStore());

  it('allows requests up to the limit within a window', () => {
    const now = 1_000_000;
    expect(rateLimit('ip:a', 3, 60_000, now).allowed).toBe(true);
    expect(rateLimit('ip:a', 3, 60_000, now).allowed).toBe(true);
    expect(rateLimit('ip:a', 3, 60_000, now).allowed).toBe(true);
  });

  it('blocks the request that exceeds the limit', () => {
    const now = 1_000_000;
    rateLimit('ip:b', 2, 60_000, now);
    rateLimit('ip:b', 2, 60_000, now);
    const third = rateLimit('ip:b', 2, 60_000, now);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it('resets after the window elapses', () => {
    const start = 1_000_000;
    rateLimit('ip:c', 1, 60_000, start);
    expect(rateLimit('ip:c', 1, 60_000, start).allowed).toBe(false);
    // After the window, the bucket resets.
    expect(rateLimit('ip:c', 1, 60_000, start + 60_001).allowed).toBe(true);
  });

  it('tracks separate keys independently', () => {
    const now = 1_000_000;
    rateLimit('ip:d', 1, 60_000, now);
    expect(rateLimit('ip:d', 1, 60_000, now).allowed).toBe(false);
    expect(rateLimit('ip:e', 1, 60_000, now).allowed).toBe(true);
  });
});
