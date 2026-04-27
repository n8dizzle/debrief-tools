import 'server-only';
import bcrypt from 'bcryptjs';
import { query } from '../db';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../jwt';
import { AppError } from '../errors';
import type { User } from '@/types';

interface UserWithHash extends User {
  password_hash: string | null;
}

export async function login(email: string, password: string) {
  const { rows } = await query<UserWithHash>(
    `SELECT id, email, role, department, home_warehouse_id, assigned_truck_id,
            first_name, last_name, phone, password_hash, is_active
       FROM users WHERE email = $1`,
    [email.toLowerCase().trim()],
  );

  const user = rows[0];
  if (!user || !user.is_active) {
    throw new AppError('Invalid email or password', 401);
  }
  if (!user.password_hash) {
    throw new AppError('Account not configured for password login', 401);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new AppError('Invalid email or password', 401);

  const access_token = signAccessToken(user.id);
  const refresh_token = signRefreshToken(user.id);

  // Strip the hash before returning
  const { password_hash: _h, ...safeUser } = user;
  void _h;
  return { access_token, refresh_token, user: safeUser as User };
}

export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const { rows } = await query<{ id: string; is_active: boolean }>(
    `SELECT id, is_active FROM users WHERE id = $1`,
    [payload.sub],
  );

  if (!rows[0] || !rows[0].is_active) {
    throw new AppError('User not found or inactive', 401);
  }

  return { access_token: signAccessToken(rows[0].id) };
}
