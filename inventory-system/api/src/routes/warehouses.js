'use strict';

const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { query } = require('../config/db');

const router = Router();
router.use(requireAuth);

// GET /api/v1/warehouses
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT w.*,
              (SELECT COUNT(*) FROM trucks t WHERE t.home_warehouse_id = w.id AND t.status = 'active') AS active_truck_count
         FROM warehouses w
        ORDER BY w.name`,
    );
    res.json({ warehouses: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/warehouses/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT w.*,
              json_agg(DISTINCT t.*) FILTER (WHERE t.id IS NOT NULL) AS trucks
         FROM warehouses w
         LEFT JOIN trucks t ON t.home_warehouse_id = w.id AND t.status = 'active'
        WHERE w.id = $1
        GROUP BY w.id`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Warehouse not found' });
    res.json({ warehouse: rows[0] });
  } catch (err) {
    next(err);
  }
});

const warehouseSchema = z.object({
  name: z.string().min(1),
  department: z.enum(['plumbing', 'hvac', 'office']),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  geo_lat: z.number().optional(),
  geo_lng: z.number().optional(),
  geo_radius_miles: z.number().positive().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

// POST /api/v1/warehouses
router.post(
  '/',
  requireRole('admin'),
  validate({ body: warehouseSchema }),
  async (req, res, next) => {
    try {
      const b = req.body;
      const { rows } = await query(
        `INSERT INTO warehouses (name, department, address, city, state, zip, geo_lat, geo_lng, geo_radius_miles)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [b.name, b.department, b.address, b.city, b.state, b.zip, b.geo_lat, b.geo_lng, b.geo_radius_miles],
      );
      res.status(201).json({ warehouse: rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/v1/warehouses/:id
router.put(
  '/:id',
  requireRole('admin'),
  validate({ body: warehouseSchema.partial() }),
  async (req, res, next) => {
    try {
      const b = req.body;
      const { rows } = await query(
        `UPDATE warehouses
            SET name            = COALESCE($1, name),
                address         = COALESCE($2, address),
                city            = COALESCE($3, city),
                state           = COALESCE($4, state),
                zip             = COALESCE($5, zip),
                geo_lat         = COALESCE($6, geo_lat),
                geo_lng         = COALESCE($7, geo_lng),
                geo_radius_miles= COALESCE($8, geo_radius_miles),
                status          = COALESCE($9, status),
                updated_at      = NOW()
          WHERE id = $10
          RETURNING *`,
        [b.name, b.address, b.city, b.state, b.zip, b.geo_lat, b.geo_lng, b.geo_radius_miles, b.status, req.params.id],
      );
      if (!rows[0]) return res.status(404).json({ error: 'Warehouse not found' });
      res.json({ warehouse: rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
