import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getServerSupabase } from "@/lib/supabase";
import type { Referrer } from "@/lib/supabase";

const MAGIC_LINK_TTL_SECONDS = 15 * 60; // 15 min
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const SESSION_COOKIE = "ref_customer_session";

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET not configured");
  return new TextEncoder().encode(secret);
}

export async function issueMagicLinkToken(referrerId: string): Promise<string> {
  return new SignJWT({ kind: "magic-link" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(referrerId)
    .setIssuedAt()
    .setExpirationTime(`${MAGIC_LINK_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyMagicLinkToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.kind !== "magic-link") return null;
    return (payload.sub as string) || null;
  } catch {
    return null;
  }
}

export async function issueSessionCookie(referrerId: string): Promise<void> {
  const token = await new SignJWT({ kind: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(referrerId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Returns the currently-authenticated referrer, or null.
 * Use in server components, route handlers, and layouts.
 */
export async function getCurrentReferrer(): Promise<Referrer | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let referrerId: string;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.kind !== "session") return null;
    referrerId = payload.sub as string;
  } catch {
    return null;
  }

  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("ref_referrers")
    .select("*")
    .eq("id", referrerId)
    .eq("is_active", true)
    .single();

  return (data as Referrer) || null;
}
