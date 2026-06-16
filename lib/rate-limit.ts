// Lightweight in-memory fixed-window rate limiter.
//
// NOTE: state is per-process and resets on deploy, like the login lockout in
// lib/auth.ts. That is acceptable for this small site to blunt brute-force and
// spam; move to Redis (or @upstash/ratelimit) if it ever runs multi-instance
// and needs shared limits.

import type { NextRequest } from 'next/server'

type Bucket = { count: number; resetAt: number }

const store = new Map<string, Bucket>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Record a hit for `key` and report whether it is within `limit` per `windowMs`.
 * `now` is injectable for deterministic tests.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  const bucket = store.get(key)

  if (!bucket || now >= bucket.resetAt) {
    const resetAt = now + windowMs
    store.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt }
  }

  bucket.count += 1
  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt }
}

/** Best-effort client IP from proxy headers (Railway sits behind a proxy). */
export function clientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}

/** Test-only: clear all buckets between tests. */
export function _resetRateLimitStore(): void {
  store.clear()
}
