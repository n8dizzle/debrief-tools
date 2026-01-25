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
    // - api/analytics/sync (cron endpoint - uses CRON_SECRET)
    // - api/gbp/insights/sync (cron endpoint - uses CRON_SECRET)
    // - api/social/sync (cron endpoint - uses CRON_SECRET)
    // - static files
    "/((?!login|api/auth|api/analytics/sync|api/gbp/insights/sync|api/social/sync|_next/static|_next/image|favicon.ico|logo.png).*)",
  ],
};
