import 'server-only';
import { getServerSession } from 'next-auth';
import { verify } from 'jsonwebtoken';
import { authOptions } from './auth';
import { query } from './db';
import { AppError } from './errors';
import type { User } from '@/types';

const MOBILE_JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';

interface MobileJwtPayload {
  sub: string; // user id
}

/**
 * Resolve the authed user. Supports two auth mechanisms:
 * 1. NextAuth session cookie (web app)
 * 2. Bearer JWT token in Authorization header (mobile app)
 *
 * Re-fetches the user row from the DB so callers always see current role/etc.
 */
export async function getAuthedUser(_req?: unknown): Promise<User> {
  // Try Bearer JWT first (mobile / API clients)
  const req = _req as { headers?: { get?: (k: string) => string | null } } | undefined;
  const authHeader = req?.headers?.get?.('authorization') ?? '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = verify(token, MOBILE_JWT_SECRET) as MobileJwtPayload;
      const { rows } = await query<User>(
        `SELECT id, first_name, last_name, email, role, department,
                home_warehouse_id, assigned_truck_id, phone, is_active
           FROM users
          WHERE id = $1 AND is_active = TRUE`,
        [payload.sub],
      );
      if (!rows[0]) throw new AppError('User not found or inactive', 401);
      return rows[0];
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError('Invalid or expired token', 401);
    }
  }

  // Fall back to NextAuth session cookie (web app)
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new AppError('Not authenticated', 401);

  const { rows } = await query<User>(
    `SELECT id, first_name, last_name, email, role, department,
            home_warehouse_id, assigned_truck_id, phone, is_active
       FROM users
      WHERE id = $1 AND is_active = TRUE`,
    [session.user.id],
  );
  if (!rows[0]) throw new AppError('User not found or inactive', 401);
  return rows[0];
}

/** Throw 403 if the user's role isn't in the allowed set. */
export function requireRole(user: User, ...roles: User['role'][]): void {
  if (!roles.includes(user.role)) {
    throw new AppError(`Access denied. Required role(s): ${roles.join(', ')}`, 403, 'FORBIDDEN');
  }
}
