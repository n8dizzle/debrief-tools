'use strict';

/**
 * Tech Bin routes
 *
 * GET  /api/v1/tech-bins               — list bins
 * POST /api/v1/tech-bins               — create bin
 * GET  /api/v1/tech-bins/by-barcode/:barcode  — look up bin by barcode scan
 * GET  /api/v1/tech-bins/:id           — bin detail + current items
 * POST /api/v1/tech-bins/:id/scan      — tech scans bin → all items transferred to assigned truck
 */

const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const binService = require('../services/binService');
const { query } = require('../config/db');

const router = Router();
router.use(requireAuth);

// GET /api/v1/tech-bins
router.get('/', async (req, res, next) => {
  try {
    const { technician_id, warehouse_id, status } = req.query;
    const conditions = [];
    const params = [];

    if (technician_id) { params.push(technician_id); conditions.push(`tb.technician_id = $${params.length}`); }
    if (warehouse_id)  { params.push(warehouse_id);  conditions.push(`tb.warehouse_id = $${params.length}`); }
    if (status)        { params.push(status);         conditions.push(`tb.status = $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await query(
      `SELECT tb.*,
              u.first_name || ' ' || u.last_name AS technician_name,
              w.name AS warehouse_name,
              COUNT(bi.id) AS item_count
         FROM tech_bins tb
         JOIN users u ON u.id = tb.technician_id
         JOIN warehouses w ON w.id = tb.warehouse_id
         LEFT JOIN bin_items bi ON bi.bin_id = tb.id AND bi.scanned_at IS NULL
        ${where}
        GROUP BY tb.id, u.first_name, u.last_name, w.name
        ORDER BY tb.bin_label`,
      params,
    );
    res.json({ bins: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tech-bins/by-barcode/:barcode
router.get('/by-barcode/:barcode', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT tb.*, u.first_name || ' ' || u.last_name AS technician_name, w.name AS warehouse_name
         FROM tech_bins tb
         JOIN users u ON u.id = tb.technician_id
         JOIN warehouses w ON w.id = tb.warehouse_id
        WHERE tb.barcode = $1`,
      [req.params.barcode],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Bin not found for barcode' });
    res.json({ bin: rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tech-bins/:id
router.get('/:id', async (req, res, next) => {
  try {
    const [binRes, itemsRes] = await Promise.all([
      query(
        `SELECT tb.*, u.first_name || ' ' || u.last_name AS technician_name,
                w.name AS warehouse_name, t.truck_number AS assigned_truck_number
           FROM tech_bins tb
           JOIN users u ON u.id = tb.technician_id
           JOIN warehouses w ON w.id = tb.warehouse_id
           LEFT JOIN trucks t ON t.id = u.assigned_truck_id
          WHERE tb.id = $1`,
        [req.params.id],
      ),
      query(
        `SELECT bi.*, m.name AS material_name, m.sku, m.unit_of_measure
           FROM bin_items bi
           JOIN materials m ON m.id = bi.material_id
          WHERE bi.bin_id = $1
          ORDER BY bi.placed_at DESC`,
        [req.params.id],
      ),
    ]);

    if (!binRes.rows[0]) return res.status(404).json({ error: 'Bin not found' });
    res.json({ bin: binRes.rows[0], items: itemsRes.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/tech-bins
router.post(
  '/',
  requireRole('admin', 'warehouse_manager', 'warehouse_staff'),
  validate({
    body: z.object({
      barcode:       z.string().min(1),
      bin_label:     z.string().min(1),
      technician_id: z.string().uuid(),
      warehouse_id:  z.string().uuid(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { rows } = await query(
        `INSERT INTO tech_bins (barcode, bin_label, technician_id, warehouse_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [req.body.barcode, req.body.bin_label, req.body.technician_id, req.body.warehouse_id],
      );
      res.status(201).json({ bin: rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/tech-bins/:id/scan
// Tech scans their bin at the warehouse — all pending items transfer to their truck
router.post('/:id/scan', async (req, res, next) => {
  try {
    const result = await binService.scanBin(req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
