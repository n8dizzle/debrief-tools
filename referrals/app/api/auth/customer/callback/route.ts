import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLinkToken, issueSessionCookie } from "@/lib/customer-auth";

/**
 * Allow "?next=/some/path" deep-links from emails (e.g. the Triple Win
 * announcement dropping the user on /dashboard/charity). The value must be
 * a same-origin absolute path: one leading slash, not "//" (protocol-relative
 * open redirect), and not the bare "/". Anything else falls back to /dashboard.
 */
function sanitizeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/")) return "/dashboard";
  if (raw.startsWith("//")) return "/dashboard";
  if (raw.length < 2) return "/dashboard";
  return raw;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(
      new URL("/enroll?error=missing-token", req.url)
    );
  }

  const referrerId = await verifyMagicLinkToken(token);
  if (!referrerId) {
    return NextResponse.redirect(
      new URL("/enroll?error=invalid-token", req.url)
    );
  }

  await issueSessionCookie(referrerId);
  const next = sanitizeNext(req.nextUrl.searchParams.get("next"));
  return NextResponse.redirect(new URL(next, req.url));
}
