import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: { signIn: '/login' },
});

export const config = {
  matcher: [
    // Protect everything except the login page, NextAuth endpoints, and static assets.
    '/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};
