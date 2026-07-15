// Pure path helper shared by the middleware and its tests. Kept free of any
// next-auth import so it can be unit-tested without pulling ESM-only deps.

/** Paths that require an authenticated admin (admin pages and admin APIs). */
export function requiresAdmin(pathname: string): boolean {
  return pathname.startsWith('/admin') || pathname.startsWith('/api/admin')
}
