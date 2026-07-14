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
// Cloudinary rejects stale timestamps (~1h), so signatures are short-lived.
export function signUploadParams() {
  const timestamp = Math.round(Date.now() / 1000)
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, upload_preset: UPLOAD_PRESET, folder: GUEST_PHOTOS_FOLDER },
    apiSecret as string
  )
  return { cloudName, apiKey, timestamp, signature, uploadPreset: UPLOAD_PRESET, folder: GUEST_PHOTOS_FOLDER }
}

// A photo record may only be created for an asset that really exists in our
// account under guest-photos/ — otherwise anyone could POST arbitrary URLs.
export async function verifyGuestPhoto(publicId: string): Promise<{ secureUrl: string } | null> {
  if (!publicId.startsWith(`${GUEST_PHOTOS_FOLDER}/`)) return null
  try {
    const res = await cloudinary.api.resource(publicId)
    return { secureUrl: res.secure_url }
  } catch {
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
