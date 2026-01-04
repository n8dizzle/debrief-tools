import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /login (login page)
     * - /api/auth (NextAuth routes)
     * - /_next (Next.js internals)
     * - /favicon.ico, /public files
     */
    "/((?!login|api/auth|_next|favicon.ico|preview).*)",
  ],
};
