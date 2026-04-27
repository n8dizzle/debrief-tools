import 'server-only';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { query } from './db';
import { AppError } from './errors';
import type { User } from '@/types';

/**
 * Resolve the authed user for the current request via the NextAuth session
 * cookie. Re-fetches the row from the `users` table so route handlers see
 * the latest role/department/etc.
 *
 * The optional `_req` parameter is unused (NextAuth reads cookies directly
 * from the request context) — kept for backward compatibility with the
 * Phase-2 callsites that pass `req`.
 */
export async function getAuthedUser(_req?: unknown): Promise<User> {
  void _req;
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
