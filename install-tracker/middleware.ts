import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: { signIn: '/login' },
});

export const config = {
  matcher: [
    // Protect everything except the login page, NextAuth endpoints, cron/sync
    // endpoints (which auth via CRON_SECRET), and static assets.
    '/((?!login|api/auth|api/sync|_next/static|_next/image|favicon.ico).*)',
  ],
};
