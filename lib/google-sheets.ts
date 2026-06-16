// Shared constants for the Google Sheets OAuth flow. Lives in lib/ (not in a
// route module) because Next.js App Router route files may only export route
// handlers and a few reserved names — exporting other values from a route
// triggers a route-type validation error.

/** Cookie holding the OAuth CSRF state token between the auth start and callback. */
export const OAUTH_STATE_COOKIE = 'g_oauth_state'
