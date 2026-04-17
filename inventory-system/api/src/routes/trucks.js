'use strict';

const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { query } = require('../config/db');

const router = Router();
router.use(requireAuth);

// GET /api/v1/trucks
router.get('/', async (req, res, next) => {
  try {
    const dept = req.query.department;
    const warehouseId = req.query.warehouse_id;

    const conditions = [];
    const params = [];

    if (dept) { params.push(dept); conditions.push(`t.department = $${params.length}`); }
    if (warehouseId) { params.push(warehouseId); conditions.push(`t.home_warehouse_id = $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await query(
      `SELECT t.*,
              w.name AS warehouse_name,
              u.first_name || ' ' || u.last_name AS primary_tech_name
         FROM trucks t
         JOIN warehouses w ON w.id = t.home_warehouse_id
         LEFT JOIN users u ON u.assigned_truck_id = t.id AND u.is_active = TRUE
        ${where}
        ORDER BY t.truck_number`,
      params,
    );
    res.json({ trucks: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/trucks/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT t.*,
              w.name AS warehouse_name,
              json_agg(
                json_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name, 'role', u.role)
              ) FILTER (WHERE u.id IS NOT NULL) AS assigned_users
         FROM trucks t
         JOIN warehouses w ON w.id = t.home_warehouse_id
         LEFT JOIN users u ON u.assigned_truck_id = t.id AND u.is_active = TRUE
        WHERE t.id = $1
        GROUP BY t.id, w.name`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Truck not found' });
    res.json({ truck: rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/trucks/:id/stock  — full stock manifest for a truck
router.get('/:id/stock', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT ts.*, m.name, m.sku, m.barcode, m.unit_of_measure, m.category,
              m.reorder_point
         FROM truck_stock ts
         JOIN materials m ON m.id = ts.material_id
        WHERE ts.truck_id = $1
        ORDER BY m.category, m.name`,
      [req.params.id],
    );
    res.json({ stock: rows });
  } catch (err) {
    next(err);
  }
});

const truckSchema = z.object({
  truck_number:     z.string().min(1),
  department:       z.enum(['plumbing', 'hvac', 'office']),
  home_warehouse_id:z.string().uuid(),
  st_vehicle_id:    z.string().optional(),
  make:             z.string().optional(),
  model:            z.string().optional(),
  year:             z.number().int().min(1990).max(2100).optional(),
  license_plate:    z.string().optional(),
  vin:              z.string().optional(),
  status:           z.enum(['active', 'inactive', 'out_of_service']).optional(),
});

// POST /api/v1/trucks
router.post(
  '/',
  requireRole('admin', 'warehouse_manager'),
  validate({ body: truckSchema }),
  async (req, res, next) => {
    try {
      const b = req.body;
      const { rows } = await query(
        `INSERT INTO trucks (truck_number, department, home_warehouse_id, st_vehicle_id, make, model, year, license_plate, vin)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [b.truck_number, b.department, b.home_warehouse_id, b.st_vehicle_id, b.make, b.model, b.year, b.license_plate, b.vin],
      );
      res.status(201).json({ truck: rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/v1/trucks/:id
router.put(
  '/:id',
  requireRole('admin', 'warehouse_manager'),
  validate({ body: truckSchema.partial() }),
  async (req, res, next) => {
    try {
      const b = req.body;
      const { rows } = await query(
        `UPDATE trucks
            SET truck_number      = COALESCE($1, truck_number),
                st_vehicle_id     = COALESCE($2, st_vehicle_id),
                make              = COALESCE($3, make),
                model             = COALESCE($4, model),
                year              = COALESCE($5, year),
                license_plate     = COALESCE($6, license_plate),
                vin               = COALESCE($7, vin),
                status            = COALESCE($8, status),
                updated_at        = NOW()
          WHERE id = $9
          RETURNING *`,
        [b.truck_number, b.st_vehicle_id, b.make, b.model, b.year, b.license_plate, b.vin, b.status, req.params.id],
      );
      if (!rows[0]) return res.status(404).json({ error: 'Truck not found' });
      res.json({ truck: rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
