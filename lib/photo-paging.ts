// The public gallery is paged newest-first, PAGE_SIZE at a time. The cursor is the
// last photo handed out, as `<createdAt ISO>_<id>`, and the next page is everything
// older than it — keyset, not offset: a photo uploaded while someone is scrolling
// lands at the top and shifts nothing underneath, so nobody is handed the same photo
// twice. Both fields, so the cursor still works if that photo has since been deleted.
export const PAGE_SIZE = 60

const CURSOR = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)_([0-9a-f-]{36})$/i

export function parseCursor(raw: string): { createdAt: Date; id: string } | null {
  const m = CURSOR.exec(raw)
  if (!m) return null
  const createdAt = new Date(m[1])
  return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id: m[2] }
}

export const cursorFor = (p: { createdAt: Date; id: string }) => `${p.createdAt.toISOString()}_${p.id}`
