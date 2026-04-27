import 'server-only';
import bcrypt from 'bcryptjs';
import { query } from '../db';
import { AppError } from '../errors';
import type { User, UserRole } from '@/types';

const SALT_ROUNDS = 12;

export interface UserListRow extends User {
  warehouse_name: string | null;
  truck_number: string | null;
}

export async function listUsers(filter: { department?: string | null; role?: string | null; isActive?: boolean | null; warehouseId?: string | null }) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.department) { params.push(filter.department); conditions.push(`u.department = $${params.length}`); }
  if (filter.role) { params.push(filter.role); conditions.push(`u.role = $${params.length}`); }
  if (filter.isActive !== null && filter.isActive !== undefined) { params.push(filter.isActive); conditions.push(`u.is_active = $${params.length}`); }
  if (filter.warehouseId) { params.push(filter.warehouseId); conditions.push(`u.home_warehouse_id = $${params.length}`); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const { rows } = await query<UserListRow>(
    `SELECT u.id, u.st_technician_id, u.first_name, u.last_name, u.email, u.phone,
            u.role, u.department, u.is_active,
            u.home_warehouse_id, w.name AS warehouse_name,
            u.assigned_truck_id, t.truck_number
       FROM users u
       LEFT JOIN warehouses w ON w.id = u.home_warehouse_id
       LEFT JOIN trucks t ON t.id = u.assigned_truck_id
      ${where}
      ORDER BY u.last_name, u.first_name`,
    params,
  );
  return rows;
}

export async function getUser(id: string): Promise<UserListRow & { created_at?: string }> {
  const { rows } = await query<UserListRow & { created_at?: string }>(
    `SELECT u.id, u.st_technician_id, u.first_name, u.last_name, u.email, u.phone,
            u.role, u.department, u.is_active, u.created_at,
            u.home_warehouse_id, w.name AS warehouse_name,
            u.assigned_truck_id, t.truck_number
       FROM users u
       LEFT JOIN warehouses w ON w.id = u.home_warehouse_id
       LEFT JOIN trucks t ON t.id = u.assigned_truck_id
      WHERE u.id = $1`,
    [id],
  );
  if (!rows[0]) throw new AppError('User not found', 404);
  return rows[0];
}

export interface CreateUserInput {
  first_name: string;
  last_name: string;
  email: string;
  /** Optional. With NextAuth (Google SSO) most users won't have a password.
   *  Provide one only for accounts that should also be able to use the
   *  Credentials fallback provider during local dev. */
  password?: string | null;
  role: UserRole;
  department?: string | null;
  phone?: string | null;
  home_warehouse_id?: string | null;
  assigned_truck_id?: string | null;
  st_technician_id?: string | null;
}

export async function createUser(b: CreateUserInput): Promise<User> {
  if (!b.email || !b.first_name || !b.last_name || !b.role) {
    throw new AppError('first_name, last_name, email, role are required', 400);
  }
  const hash = b.password ? await bcrypt.hash(b.password, SALT_ROUNDS) : null;
  const { rows } = await query<User>(
    `INSERT INTO users
       (first_name, last_name, email, password_hash, role, department,
        phone, home_warehouse_id, assigned_truck_id, st_technician_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, first_name, last_name, email, role, department,
               phone, home_warehouse_id, assigned_truck_id, st_technician_id, is_active, created_at`,
    [b.first_name, b.last_name, b.email.toLowerCase(), hash, b.role, b.department ?? null,
     b.phone ?? null, b.home_warehouse_id ?? null, b.assigned_truck_id ?? null, b.st_technician_id ?? null],
  );
  return rows[0];
}

export interface UpdateUserInput {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string | null;
  role?: UserRole;
  department?: string | null;
  home_warehouse_id?: string | null;
  assigned_truck_id?: string | null;
  st_technician_id?: string | null;
}

export async function updateUser(id: string, b: UpdateUserInput): Promise<User> {
  const { rows } = await query<User>(
    `UPDATE users
        SET first_name        = COALESCE($1, first_name),
            last_name         = COALESCE($2, last_name),
            email             = COALESCE($3, email),
            phone             = COALESCE($4, phone),
            role              = COALESCE($5, role),
            department        = COALESCE($6, department),
            home_warehouse_id = COALESCE($7, home_warehouse_id),
            assigned_truck_id = COALESCE($8, assigned_truck_id),
            st_technician_id  = COALESCE($9, st_technician_id),
            updated_at        = NOW()
      WHERE id = $10
      RETURNING id, first_name, last_name, email, phone, role, department,
                home_warehouse_id, assigned_truck_id, st_technician_id, is_active`,
    [b.first_name ?? null, b.last_name ?? null, b.email ?? null, b.phone ?? null, b.role ?? null,
     b.department ?? null, b.home_warehouse_id ?? null, b.assigned_truck_id ?? null,
     b.st_technician_id ?? null, id],
  );
  if (!rows[0]) throw new AppError('User not found', 404);
  return rows[0];
}

export async function setUserActive(id: string, active: boolean) {
  await query(`UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2`, [active, id]);
}
