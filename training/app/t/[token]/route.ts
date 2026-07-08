import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLinkToken, buildSessionCookie } from "@/lib/tech-auth";

export const runtime = "nodejs";

// PUBLIC. The texted link lands here: /t/<magic-link-token>. Verify it, drop a
// session cookie, and send the tech to their inbox. Bad/expired link → a friendly
// page telling them to use the latest text.
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const personId = await verifyMagicLinkToken(token);
  const origin = new URL(req.url).origin;

  if (!personId) {
    return NextResponse.redirect(`${origin}/inbox?expired=1`);
  }

  const res = NextResponse.redirect(`${origin}/inbox`);
  const c = await buildSessionCookie(personId);
  res.cookies.set(c.name, c.value, c.options);
  return res;
}
