import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    // Protect only /admin and /dashboard. Everything else (landing, /refer/[code],
    // /enroll, /triple-win, auth endpoints, webhooks) is public.
    "/admin/:path*",
    "/dashboard/:path*",
  ],
};
