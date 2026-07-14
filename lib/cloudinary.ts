import { v2 as cloudinary } from 'cloudinary'

export const GUEST_PHOTOS_FOLDER = 'guest-photos'
export const UPLOAD_PRESET = 'guest-photos-signed'

const cloudName = process.env.CLOUDINARY_CLOUD_NAME
const apiKey = process.env.CLOUDINARY_API_KEY
const apiSecret = process.env.CLOUDINARY_API_SECRET

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret })
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(cloudName && apiKey && apiSecret)
}

// Params the browser needs to upload directly to Cloudinary. The signature
// covers exactly the params the client will send (timestamp, preset, folder);
// Cloudinary rejects stale timestamps (~1h window). A signature is
// deliberately not single-use — within the window it can upload multiple
// files; the /photos gallery is open-upload by design, so the sign endpoint's
// rate limit bounds minting, not upload count.
export function signUploadParams() {
  if (!apiSecret) throw new Error('Cloudinary not configured')
  const timestamp = Math.round(Date.now() / 1000)
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, upload_preset: UPLOAD_PRESET, folder: GUEST_PHOTOS_FOLDER },
    apiSecret
  )
  return { cloudName, apiKey, timestamp, signature, uploadPreset: UPLOAD_PRESET, folder: GUEST_PHOTOS_FOLDER }
}

// Strict allowlist: exactly one [A-Za-z0-9_-] segment under guest-photos/ —
// no dots, no slashes — which kills `guest-photos/../x` traversal ambiguity.
const GUEST_PHOTO_ID_PATTERN = new RegExp(`^${GUEST_PHOTOS_FOLDER}/[A-Za-z0-9_-]+$`)

// A photo record may only be created for an asset that really exists in our
// account under guest-photos/ — otherwise anyone could POST arbitrary URLs.
export async function verifyGuestPhoto(publicId: string): Promise<{ secureUrl: string } | null> {
  if (!GUEST_PHOTO_ID_PATTERN.test(publicId)) return null
  try {
    const res = await cloudinary.api.resource(publicId)
    // Defense in depth: the returned asset must be exactly the one requested.
    if (res.public_id !== publicId) return null
    return { secureUrl: res.secure_url }
  } catch (error) {
    // 404 (asset doesn't exist) is an expected outcome; anything else —
    // auth failure, rate limit, network — deserves a log line.
    const httpCode = (error as { error?: { http_code?: number } })?.error?.http_code
    if (httpCode !== 404) {
      console.error('Cloudinary verify failed for', publicId, error)
    }
    return null
  }
}

export async function destroyPhoto(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId)
}

export function photoUrls(publicId: string) {
  const base = `https://res.cloudinary.com/${cloudName}/image/upload`
  return {
    fileUrl: `${base}/f_auto,q_auto/${publicId}`,
    thumbnailUrl: `${base}/w_600,f_auto,q_auto/${publicId}`,
  }
}
