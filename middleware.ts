import { withAuth } from "next-auth/middleware"
// requiresAdmin lives in lib/ so it can be unit-tested without importing
// next-auth (which pulls ESM-only deps Jest can't transform). NOTE: each
// /api/admin/* handler also enforces this — middleware is a backstop so a newly
// added admin route can't be left unprotected by accident.
import { requiresAdmin } from "./lib/admin-paths"

export default withAuth(
  function middleware() {
    // Add custom logic here if needed
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (requiresAdmin(req.nextUrl.pathname)) {
          return token?.role === "admin"
        }
        return !!token
      },
    },
  }
)

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"]
}
