import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getServerSupabase } from "@/lib/supabase";

// Tech (technician) magic-link auth — person-scoped, no account/password.
// Modeled on referrals/lib/customer-auth.ts (jose JWT). The texted link carries a
// long-lived magic-link token (techs may tap an old text days later); tapping issues
// a session cookie. Phase-1 note: this is a signed stateless token. DB-backed
// revocation via train_magic_links (rotate a per-person token) is a later refinement.

const MAGIC_LINK_TTL_SECONDS = 60 * 60 * 24 * 180; // 180 days — techs tap old texts
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days
const SESSION_COOKIE = "ca_tech_session";

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET not configured");
  return new TextEncoder().encode(secret);
}

export interface TechPerson {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
}

export async function issueMagicLinkToken(personId: string): Promise<string> {
  return new SignJWT({ kind: "tech-magic-link" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(personId)
    .setIssuedAt()
    .setExpirationTime(`${MAGIC_LINK_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyMagicLinkToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.kind !== "tech-magic-link") return null;
    return (payload.sub as string) || null;
  } catch {
    return null;
  }
}

// Returns a Set-Cookie header value for the session (used by the /t/[token] route).
export async function buildSessionCookie(personId: string): Promise<{ name: string; value: string; options: object }> {
  const token = await new SignJWT({ kind: "tech-session" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(personId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
  return {
    name: SESSION_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: SESSION_TTL_SECONDS,
      path: "/",
    },
  };
}

// Current tech from the session cookie, or null. Use in tech pages/routes.
export async function getCurrentTech(): Promise<TechPerson | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  let personId: string;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.kind !== "tech-session") return null;
    personId = payload.sub as string;
  } catch {
    return null;
  }
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("train_people")
    .select("id, name, phone, active")
    .eq("id", personId)
    .eq("active", true)
    .single();
  return (data as TechPerson) || null;
}
