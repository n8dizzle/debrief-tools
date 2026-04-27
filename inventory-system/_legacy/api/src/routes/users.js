'use strict';

const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { query } = require('../config/db');
const authService = require('../services/authService');

const router = Router();
router.use(requireAuth);

const userRoles = ['admin', 'warehouse_manager', 'warehouse_staff', 'technician', 'office_staff', 'it_admin'];

// GET /api/v1/users
router.get('/', async (req, res, next) => {
  try {
    const { department, role, is_active, warehouse_id } = req.query;
    const conditions = [];
    const params = [];

    if (department)  { params.push(department);  conditions.push(`u.department = $${params.length}`); }
    if (role)        { params.push(role);         conditions.push(`u.role = $${params.length}`); }
    if (is_active !== undefined) {
      params.push(is_active === 'true');
      conditions.push(`u.is_active = $${params.length}`);
    }
    if (warehouse_id) { params.push(warehouse_id); conditions.push(`u.home_warehouse_id = $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await query(
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
    res.json({ users: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/users/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.st_technician_id, u.first_name, u.last_name, u.email, u.phone,
              u.role, u.department, u.is_active, u.created_at,
              u.home_warehouse_id, w.name AS warehouse_name,
              u.assigned_truck_id, t.truck_number
         FROM users u
         LEFT JOIN warehouses w ON w.id = u.home_warehouse_id
         LEFT JOIN trucks t ON t.id = u.assigned_truck_id
        WHERE u.id = $1`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

const createUserSchema = z.object({
  first_name:        z.string().min(1),
  last_name:         z.string().min(1),
  email:             z.string().email(),
  password:          z.string().min(8),
  role:              z.enum(userRoles),
  department:        z.enum(['plumbing', 'hvac', 'office']).optional(),
  phone:             z.string().optional(),
  home_warehouse_id: z.string().uuid().optional(),
  assigned_truck_id: z.string().uuid().optional(),
  st_technician_id:  z.string().optional(),
});

// POST /api/v1/users
router.post(
  '/',
  requireRole('admin'),
  validate({ body: createUserSchema }),
  async (req, res, next) => {
    try {
      const user = await authService.createUser(req.body);
      res.status(201).json({ user });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/v1/users/:id
router.put(
  '/:id',
  requireRole('admin', 'warehouse_manager'),
  validate({
    body: createUserSchema.omit({ password: true }).partial(),
  }),
  async (req, res, next) => {
    try {
      const b = req.body;
      const { rows } = await query(
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
        [b.first_name, b.last_name, b.email, b.phone, b.role, b.department,
         b.home_warehouse_id, b.assigned_truck_id, b.st_technician_id, req.params.id],
      );
      if (!rows[0]) return res.status(404).json({ error: 'User not found' });
      res.json({ user: rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/users/:id/deactivate
router.patch('/:id/deactivate', requireRole('admin'), async (req, res, next) => {
  try {
    await query(`UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, [req.params.id]);
    res.json({ message: 'User deactivated' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/users/:id/activate
router.patch('/:id/activate', requireRole('admin'), async (req, res, next) => {
  try {
    await query(`UPDATE users SET is_active = TRUE, updated_at = NOW() WHERE id = $1`, [req.params.id]);
    res.json({ message: 'User activated' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
