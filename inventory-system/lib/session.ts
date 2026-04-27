// Session helpers — wraps the Express JWT in an HttpOnly cookie.
// Phase 0/1: Express stays the auth source of truth; this file is the
// bridge between Next.js cookies and the Bearer-token API.
// Phase 3 will replace this with NextAuth.

import { cookies } from 'next/headers';
import type { User } from '@/types';

const COOKIE_NAME = 'inventory_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionData {
  access_token: string;
  refresh_token: string;
  user: User;
}

export async function setSession(data: SessionData) {
  const store = await cookies();
  store.set(COOKIE_NAME, JSON.stringify(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

export async function getSession(): Promise<SessionData | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
