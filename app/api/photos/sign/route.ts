import { NextRequest, NextResponse } from 'next/server'
import { isCloudinaryConfigured, signUploadParams } from '@/lib/cloudinary'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    if (!isCloudinaryConfigured()) {
      return NextResponse.json({ error: 'Photo uploads are not available yet' }, { status: 503 })
    }
    // Take the LAST x-forwarded-for hop: Railway's proxy appends the real
    // client IP, while leftmost entries are client-controllable (a client can
    // send its own XFF header to evade the rate limit).
    const ip = request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'unknown'
    // Per-IP means per-venue-NAT at the reception; 600/hr still blocks scripted floods without capping 200 guests' legitimate burst.
    if (!checkRateLimit(`photo-sign:${ip}`, 600, 60 * 60 * 1000)) {
      return NextResponse.json({ error: 'Too many uploads — please wait a bit' }, { status: 429 })
    }
    return NextResponse.json(signUploadParams())
  } catch (error) {
    console.error('Error signing upload:', error)
    return NextResponse.json({ error: 'Failed to prepare upload' }, { status: 500 })
  }
}
