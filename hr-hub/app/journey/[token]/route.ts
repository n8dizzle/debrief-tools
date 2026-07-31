import { NextRequest, NextResponse } from 'next/server';
import { verifyMagicLinkToken, sessionCookie } from '@/lib/tech-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /journey/[token] — consume a texted magic link: verify it, set the tech
// session cookie, and land on /me. Invalid/expired links land on /me?e=expired.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const stId = await verifyMagicLinkToken(token);
  if (!stId) {
    return NextResponse.redirect(new URL('/me?e=expired', req.url));
  }
  const res = NextResponse.redirect(new URL('/me', req.url));
  const c = await sessionCookie(stId);
  res.cookies.set(c.name, c.value, c.options as any);
  return res;
}
