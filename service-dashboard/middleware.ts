import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/((?!login|q/|api/auth|api/cron|api/public|_next/static|_next/image|favicon.ico|logo.png).*)",
  ],
};
