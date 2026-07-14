// Client-only: device identity for the photos page. Name is asked once and
// remembered; deviceId anonymously scopes likes to this browser.
const NAME_KEY = 'photos.name'
const DEVICE_KEY = 'photos.deviceId'

export function getStoredName(): string | null {
  const name = localStorage.getItem(NAME_KEY)?.trim()
  return name ? name : null
}

export function setStoredName(name: string) {
  localStorage.setItem(NAME_KEY, name.trim())
}

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
          })
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}
