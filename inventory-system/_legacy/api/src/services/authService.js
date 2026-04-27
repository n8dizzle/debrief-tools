'use strict';

/**
 * Auth Service
 *
 * NOTE: The users table requires a password_hash column.
 * Run this migration before using auth:
 *   ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query, transaction } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

const SALT_ROUNDS = 12;

/**
 * Sign a short-lived access token
 */
function signAccessToken(userId) {
  return jwt.sign({ sub: userId }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

/**
 * Sign a long-lived refresh token
 */
function signRefreshToken(userId) {
  return jwt.sign({ sub: userId }, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshExpiresIn });
}

/**
 * Login — return access + refresh tokens
 */
async function login(email, password) {
  const { rows } = await query(
    `SELECT id, email, role, department, home_warehouse_id, password_hash, is_active
       FROM users WHERE email = $1`,
    [email],
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

  const accessToken  = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);

  // Return user without hash
  const { password_hash: _hash, ...safeUser } = user;

  return { access_token: accessToken, refresh_token: refreshToken, user: safeUser };
}

/**
 * Refresh — verify refresh token and issue new access token
 */
async function refresh(refreshToken) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, env.jwt.refreshSecret);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const { rows } = await query(
    `SELECT id, is_active FROM users WHERE id = $1`,
    [payload.sub],
  );

  if (!rows[0] || !rows[0].is_active) {
    throw new AppError('User not found or inactive', 401);
  }

  const accessToken = signAccessToken(rows[0].id);
  return { access_token: accessToken };
}

/**
 * Create a new user with a hashed password
 */
async function createUser(data) {
  const hash = await bcrypt.hash(data.password, SALT_ROUNDS);

  const { rows } = await query(
    `INSERT INTO users
       (first_name, last_name, email, password_hash, role, department,
        phone, home_warehouse_id, assigned_truck_id, st_technician_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, first_name, last_name, email, role, department,
               phone, home_warehouse_id, assigned_truck_id, st_technician_id, is_active, created_at`,
    [data.first_name, data.last_name, data.email, hash, data.role, data.department,
     data.phone, data.home_warehouse_id, data.assigned_truck_id, data.st_technician_id],
  );

  return rows[0];
}

/**
 * Change password — verify current, set new
 */
async function changePassword(userId, currentPassword, newPassword) {
  const { rows } = await query(
    `SELECT password_hash FROM users WHERE id = $1`,
    [userId],
  );

  if (!rows[0]?.password_hash) throw new AppError('No password set for this account', 400);

  const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!valid) throw new AppError('Current password is incorrect', 400);

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [newHash, userId],
  );
}

module.exports = { login, refresh, createUser, changePassword };
