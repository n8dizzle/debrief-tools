'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { AppError } = require('./errorHandler');
const { query } = require('../config/db');

/**
 * Verify the Bearer token and attach req.user.
 * req.user = { id, email, role, department, home_warehouse_id }
 */
const requireAuth = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = header.slice(7);
    const payload = jwt.verify(token, env.jwt.secret);

    // Lightweight re-check that user still exists and is active
    const { rows } = await query(
      `SELECT id, first_name, last_name, email, role, department,
              home_warehouse_id, assigned_truck_id, phone
         FROM users
        WHERE id = $1 AND is_active = TRUE`,
      [payload.sub],
    );

    if (!rows[0]) {
      throw new AppError('User not found or inactive', 401);
    }

    req.user = rows[0];
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Role-based access control.
 * Usage: requireRole('admin', 'warehouse_manager')
 */
const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }
  if (!roles.includes(req.user.role)) {
    return next(
      new AppError(
        `Access denied. Required role(s): ${roles.join(', ')}`,
        403,
        'FORBIDDEN',
      ),
    );
  }
  next();
};

/**
 * Ensure the requesting user belongs to the same department
 * as a given department param, OR is admin.
 * Usage: requireDept(req.params.department)
 */
const requireDept = (deptField = 'department') => (req, _res, next) => {
  if (req.user.role === 'admin') return next();
  const dept = req.params[deptField] || req.body[deptField] || req.query[deptField];
  if (dept && req.user.department && req.user.department !== dept) {
    return next(new AppError('Access denied to this department', 403, 'WRONG_DEPT'));
  }
  next();
};

module.exports = { requireAuth, requireRole, requireDept };
