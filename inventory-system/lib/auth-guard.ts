import 'server-only';
import { type NextRequest } from 'next/server';
import { query } from './db';
import { verifyAccessToken } from './jwt';
import { AppError } from './errors';
import type { User } from '@/types';

/**
 * Verify the Authorization Bearer token, look the user up, return them.
 * Throws AppError(401) if missing/invalid.
 */
export async function getAuthedUser(req: NextRequest): Promise<User> {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    throw new AppError('No token provided', 401);
  }

  const token = header.slice(7).trim();
  const payload = verifyAccessToken(token);

  const { rows } = await query<User>(
    `SELECT id, first_name, last_name, email, role, department,
            home_warehouse_id, assigned_truck_id, phone, is_active
       FROM users
      WHERE id = $1 AND is_active = TRUE`,
    [payload.sub],
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
