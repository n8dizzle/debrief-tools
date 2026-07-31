import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { getServerSupabase } from '@/lib/supabase';

// Technician self-view auth — person-scoped, no account/password. A texted link
// carries a long-lived magic-link token (techs may tap an old text days later);
// tapping issues a session cookie. Mirrors training.christmasair.com's tech-auth,
// keyed here to the ServiceTitan technician id (st_technician_id).

const MAGIC_LINK_TTL_SECONDS = 60 * 60 * 24 * 180; // 180 days
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days
const SESSION_COOKIE = 'ca_hr_tech_session';

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET not configured');
  return new TextEncoder().encode(secret);
}

export interface SelfTech {
  st_technician_id: number;
  name: string;
}

export async function issueMagicLinkToken(stId: number): Promise<string> {
  return new SignJWT({ kind: 'hr-tech-magic-link' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(stId))
    .setIssuedAt()
    .setExpirationTime(`${MAGIC_LINK_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyMagicLinkToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.kind !== 'hr-tech-magic-link') return null;
    const sub = Number(payload.sub);
    return Number.isFinite(sub) ? sub : null;
  } catch {
    return null;
  }
}

export function sessionCookie(stId: number): Promise<{ name: string; value: string; options: object }> {
  return new SignJWT({ kind: 'hr-tech-session' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(stId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret())
    .then((value) => ({
      name: SESSION_COOKIE,
      value,
      options: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: SESSION_TTL_SECONDS, path: '/' },
    }));
}

/** Current technician from the session cookie, or null. */
export async function getCurrentTech(): Promise<SelfTech | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  let stId: number;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.kind !== 'hr-tech-session') return null;
    stId = Number(payload.sub);
    if (!Number.isFinite(stId)) return null;
  } catch {
    return null;
  }
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from('ap_technicians')
    .select('st_technician_id, name, is_active')
    .eq('st_technician_id', stId)
    .eq('is_active', true)
    .maybeSingle();
  if (!data) return null;
  return { st_technician_id: Number(data.st_technician_id), name: data.name };
}
