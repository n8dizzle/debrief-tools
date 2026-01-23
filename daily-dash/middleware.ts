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
    // - api/huddle/backfill (cron endpoint - uses CRON_SECRET)
    // - api/huddle/snapshots/sync (cron endpoint - uses CRON_SECRET)
    // - static files
    "/((?!login|api/auth|api/huddle/backfill|api/huddle/snapshots/sync|_next/static|_next/image|favicon.ico|logo.png).*)",
  ],
};
