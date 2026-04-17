'use strict';

/**
 * Equipment routes (ServiceTitan mirror — primarily read-only)
 *
 * Equipment records are synced from ST and should not be edited directly,
 * except for warehouse location when items are staged in stock.
 */

const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { query } = require('../config/db');

const router = Router();
router.use(requireAuth);

// GET /api/v1/equipment
router.get('/', async (req, res, next) => {
  try {
    const { status, department, warehouse_id, search, limit = 50, offset = 0 } = req.query;
    const conditions = [];
    const params = [];

    if (status)      { params.push(status);       conditions.push(`e.status = $${params.length}`); }
    if (department)  { params.push(department);   conditions.push(`e.department = $${params.length}`); }
    if (warehouse_id){ params.push(warehouse_id); conditions.push(`e.warehouse_id = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(e.name ILIKE $${params.length} OR e.serial_number ILIKE $${params.length} OR e.model ILIKE $${params.length})`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(parseInt(limit), parseInt(offset));

    const { rows } = await query(
      `SELECT e.*,
              w.name  AS warehouse_name,
              wl.label AS location_label,
              u.first_name || ' ' || u.last_name AS installed_by_name,
              t.truck_number AS installed_truck_number
         FROM equipment e
         LEFT JOIN warehouses w ON w.id = e.warehouse_id
         LEFT JOIN warehouse_locations wl ON wl.id = e.warehouse_location_id
         LEFT JOIN users u ON u.id = e.installed_by_tech
         LEFT JOIN trucks t ON t.id = e.installed_truck
        ${where}
        ORDER BY e.name
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json({ equipment: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/equipment/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT e.*, w.name AS warehouse_name, wl.label AS location_label,
              u.first_name || ' ' || u.last_name AS installed_by_name
         FROM equipment e
         LEFT JOIN warehouses w ON w.id = e.warehouse_id
         LEFT JOIN warehouse_locations wl ON wl.id = e.warehouse_location_id
         LEFT JOIN users u ON u.id = e.installed_by_tech
        WHERE e.id = $1`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Equipment not found' });
    res.json({ equipment: rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/equipment/by-st-id/:stId
router.get('/by-st-id/:stId', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM equipment WHERE st_equipment_id = $1`,
      [req.params.stId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Equipment not found' });
    res.json({ equipment: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/equipment/:id/location — update warehouse location for in-stock units
router.patch(
  '/:id/location',
  requireRole('admin', 'warehouse_manager', 'warehouse_staff'),
  validate({
    body: z.object({
      warehouse_id:          z.string().uuid().optional(),
      warehouse_location_id: z.string().uuid().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { rows } = await query(
        `UPDATE equipment
            SET warehouse_id          = COALESCE($1, warehouse_id),
                warehouse_location_id = COALESCE($2, warehouse_location_id),
                updated_at            = NOW()
          WHERE id = $3 AND status = 'in_stock'
          RETURNING *`,
        [req.body.warehouse_id, req.body.warehouse_location_id, req.params.id],
      );
      if (!rows[0]) return res.status(404).json({ error: 'Equipment not found or not in-stock' });
      res.json({ equipment: rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
