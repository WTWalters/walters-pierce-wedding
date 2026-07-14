// scripts/setup-cloudinary-preset.mjs
// One-time (idempotent): creates the signed upload preset used by /photos.
// Run: node scripts/setup-cloudinary-preset.mjs
import { v2 as cloudinary } from 'cloudinary'
import { config } from 'dotenv'
config({ path: '.env.local' })

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const NAME = 'guest-photos-signed'
const settings = {
  unsigned: false,
  folder: 'guest-photos',
  allowed_formats: 'jpg,jpeg,png,gif,webp,heic,heif,avif',
  overwrite: false,
  unique_filename: true,
}

try {
  await cloudinary.api.create_upload_preset({ name: NAME, ...settings })
  console.log(`Created preset ${NAME}`)
} catch (err) {
  const message = String(err?.error?.message ?? err)
  const alreadyExists = err?.error?.http_code === 409 || /already (exists|been taken)/i.test(message)
  if (alreadyExists) {
    await cloudinary.api.update_upload_preset(NAME, settings)
    console.log(`Preset ${NAME} already existed — settings re-applied`)
  } else {
    throw err
  }
}
