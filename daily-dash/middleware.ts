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
    // - api/huddle/* (cron endpoints - use CRON_SECRET)
    // - api/trades/sync* (cron endpoints - use CRON_SECRET)
    // - api/reviews/sync (cron endpoint - uses CRON_SECRET)
    // - static files
    "/((?!login|api/auth|api/huddle/backfill|api/huddle/snapshots/sync|api/trades/sync|api/trades/sync-monthly|api/reviews/sync|_next/static|_next/image|favicon.ico|logo.png).*)",
  ],
};
