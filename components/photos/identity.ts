// Client-only: device identity for the photos page. Name is asked once and
// remembered; deviceId anonymously scopes likes to this browser.
//
// Some browsers throw on any localStorage access (Safari/Chrome with
// "Block all cookies"; some webviews), so all storage access goes through
// safe helpers with an in-memory fallback. Degradation when storage is
// blocked: the name is re-asked on the next visit and likes are scoped
// per page-load — acceptable.
const NAME_KEY = 'photos.name'
const DEVICE_KEY = 'photos.deviceId'

const memory: { name: string | null; deviceId: string | null } = {
  name: null,
  deviceId: null,
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage blocked — in-memory fallback carries the value instead.
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Storage blocked — nothing to remove.
  }
}

export function getStoredName(): string | null {
  const name = (safeGet(NAME_KEY) ?? memory.name)?.trim()
  return name ? name : null
}

export function setStoredName(name: string) {
  const trimmed = name.trim()
  if (!trimmed) {
    safeRemove(NAME_KEY)
    memory.name = null
    return
  }
  safeSet(NAME_KEY, trimmed)
  memory.name = trimmed
}

export function getDeviceId(): string {
  let id = safeGet(DEVICE_KEY) ?? memory.deviceId
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
          })
    safeSet(DEVICE_KEY, id)
    memory.deviceId = id
  }
  return id
}
