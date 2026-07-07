import { withAuth } from "next-auth/middleware";

// Route segmentation — matches the referrals app (refer.christmasair.com):
//   PUBLIC by default -> /train (tech-facing) and everything else. Techs never log in.
//   SSO-GATED         -> ONLY /admin/* (manager dashboard), same Google/portal_users
//                        badge login as AR / AP / Service.
//   API routes self-guard (e.g. /api/spike/send & /results check CRON_SECRET).
//
// Default-open, lock only /admin. Cleaner for a mostly-public app, and lets the Phase 1
// tech magic-link cookie tier drop in without fighting the middleware.
export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: ["/admin/:path*"],
};
