import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    // Protect all routes except:
    // - login page
    // - api/auth (NextAuth endpoints)
    // - api/cron/sync (cron endpoint - uses CRON_SECRET)
    // - api/sync/backfill (cron endpoint - uses CRON_SECRET)
    // - static files
    "/((?!login|api/auth|api/cron/sync|api/sync/backfill|_next/static|_next/image|favicon.ico|logo.png).*)",
  ],
};
