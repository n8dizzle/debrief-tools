// Typed fetch wrapper that calls the existing Express API.
// Phase 0/1 only — Phase 2 will replace this with direct DB access.

import { getSession } from './session';

const BASE = process.env.INVENTORY_API_BASE_URL || 'http://localhost:3100/api/v1';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Cache strategy. Use 'no-store' for always-fresh, default for ISR. */
  cache?: RequestCache;
  /** Override session token (e.g. during login flow). */
  token?: string;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/**
 * Server-side authed fetch. Reads JWT from session cookie; throws ApiError on
 * non-2xx. Returns parsed JSON or null for empty 204 responses.
 */
export async function api<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, cache = 'no-store', token } = opts;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  let bearer = token;
  if (!bearer) {
    const session = await getSession();
    bearer = session?.access_token;
  }
  if (bearer) headers['Authorization'] = `Bearer ${bearer}`;

  const url = `${BASE}${path.startsWith('/') ? path : `/${path}`}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache,
  });

  if (res.status === 204) return null as T;

  let parsed: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const errMessage =
      (parsed as { error?: string; message?: string })?.error ||
      (parsed as { error?: string; message?: string })?.message ||
      `${method} ${path} failed with ${res.status}`;
    throw new ApiError(res.status, parsed, errMessage);
  }

  return parsed as T;
}

/** Bare fetch without the session — used by the login form to mint a token. */
export async function login(email: string, password: string) {
  const url = `${BASE}/auth/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  });
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, parsed, parsed?.error || 'Login failed');
  }
  return parsed;
}
