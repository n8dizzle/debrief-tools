import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    // Protect all routes except login, api/auth, cron endpoints, and static files
    "/((?!login|api/auth|api/cron|api/huddle/backfill|api/huddle/sync-status|_next/static|_next/image|favicon.ico|logo.png).*)",
  ],
};
