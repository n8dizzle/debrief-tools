import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLinkToken, issueSessionCookie } from "@/lib/customer-auth";

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
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
