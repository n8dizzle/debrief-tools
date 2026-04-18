import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    // Only /admin uses NextAuth (Google OAuth via portal_users). Everything else
    // is public OR uses the customer magic-link cookie (see lib/customer-auth.ts).
    // /dashboard is customer-authed, so it handles its own guard in the layout.
    "/admin/:path*",
  ],
};
