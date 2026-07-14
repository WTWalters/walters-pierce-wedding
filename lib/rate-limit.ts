// In-memory per-key throttle. Same conscious trade-off as loginAttempts in
// lib/auth.ts: resets on deploy/restart, single-instance only — acceptable
// for a single-dyno wedding site.
const buckets = new Map<string, { count: number; windowStart: number }>()

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now })
    return true
  }
  bucket.count++
  return bucket.count <= limit
}

export function __resetRateLimits() {
  buckets.clear()
}
