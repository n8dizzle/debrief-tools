import { withAuth } from "next-auth/middleware";

// Route segmentation (locked in eng review):
//   PUBLIC (no SSO)  -> /train (tech-facing spike page), /api/spike/* (tap/complete/send/results)
//   PUBLIC (auth)    -> /login, /api/auth/*
//   SSO-GATED        -> everything else (the manager dashboard, incl. /spike-results)
//
// The tech never has an account. The public tech surface must NOT be trapped behind SSO,
// and the admin surface must NOT be accidentally exposed. This matcher is the boundary.
export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/((?!login|train|api/auth|api/spike|_next/static|_next/image|favicon.ico|logo.png).*)",
  ],
};
