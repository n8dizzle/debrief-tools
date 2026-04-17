'use strict';

const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { query } = require('../config/db');

const router = Router();
router.use(requireAuth);

// GET /api/v1/materials  — searchable, filterable catalog
router.get('/', async (req, res, next) => {
  try {
    const { department, category, search, is_active, below_reorder } = req.query;
    const conditions = [];
    const params = [];

    if (department) { params.push(department); conditions.push(`m.department = $${params.length}`); }
    if (category)   { params.push(category);   conditions.push(`m.category   = $${params.length}`); }
    if (is_active !== undefined) {
      params.push(is_active !== 'false');
      conditions.push(`m.is_active = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(m.name ILIKE $${params.length} OR m.sku ILIKE $${params.length} OR m.barcode ILIKE $${params.length})`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    // Optionally filter materials where any warehouse is below reorder_point
    const havingClause = below_reorder === 'true'
      ? `HAVING COALESCE(SUM(ws.quantity_on_hand), 0) <= m.reorder_point`
      : '';

    const { rows } = await query(
      `SELECT m.*,
              ps.name AS primary_supply_house_name,
              ss.name AS secondary_supply_house_name,
              COALESCE(SUM(ws.quantity_on_hand), 0) AS total_warehouse_stock,
              COALESCE(SUM(ts.quantity_on_hand), 0) AS total_truck_stock
         FROM materials m
         LEFT JOIN supply_houses ps ON ps.id = m.primary_supply_house_id
         LEFT JOIN supply_houses ss ON ss.id = m.secondary_supply_house_id
         LEFT JOIN warehouse_stock ws ON ws.material_id = m.id
         LEFT JOIN truck_stock ts ON ts.material_id = m.id
        ${where}
        GROUP BY m.id, ps.name, ss.name
        ${havingClause}
        ORDER BY m.category, m.name`,
      params,
    );
    res.json({ materials: rows, count: rows.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/materials/by-barcode/:barcode
router.get('/by-barcode/:barcode', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT m.*,
              COALESCE(SUM(ws.quantity_on_hand), 0) AS total_warehouse_stock,
              COALESCE(SUM(ts.quantity_on_hand), 0) AS total_truck_stock
         FROM materials m
         LEFT JOIN warehouse_stock ws ON ws.material_id = m.id
         LEFT JOIN truck_stock ts ON ts.material_id = m.id
        WHERE m.barcode = $1
        GROUP BY m.id`,
      [req.params.barcode],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Material not found for barcode' });
    res.json({ material: rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/materials/:id
router.get('/:id', async (req, res, next) => {
  try {
    // Full detail: stock by warehouse + truck breakdown
    const [matRes, warehouseStockRes, truckStockRes] = await Promise.all([
      query(
        `SELECT m.*, ps.name AS primary_supply_house_name, ss.name AS secondary_supply_house_name
           FROM materials m
           LEFT JOIN supply_houses ps ON ps.id = m.primary_supply_house_id
           LEFT JOIN supply_houses ss ON ss.id = m.secondary_supply_house_id
          WHERE m.id = $1`,
        [req.params.id],
      ),
      query(
        `SELECT ws.*, w.name AS warehouse_name, wl.label AS location_label
           FROM warehouse_stock ws
           JOIN warehouses w ON w.id = ws.warehouse_id
           LEFT JOIN warehouse_locations wl ON wl.id = ws.location_id
          WHERE ws.material_id = $1`,
        [req.params.id],
      ),
      query(
        `SELECT ts.*, t.truck_number
           FROM truck_stock ts
           JOIN trucks t ON t.id = ts.truck_id
          WHERE ts.material_id = $1 AND ts.quantity_on_hand > 0`,
        [req.params.id],
      ),
    ]);

    if (!matRes.rows[0]) return res.status(404).json({ error: 'Material not found' });
    res.json({
      material: matRes.rows[0],
      warehouse_stock: warehouseStockRes.rows,
      truck_stock: truckStockRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

const materialSchema = z.object({
  name:                       z.string().min(1),
  description:                z.string().optional(),
  sku:                        z.string().optional(),
  barcode:                    z.string().optional(),
  unit_of_measure:            z.string().optional(),
  department:                 z.enum(['plumbing', 'hvac', 'office']),
  category:                   z.string().optional(),
  st_pricebook_id:            z.string().optional(),
  unit_cost:                  z.number().min(0).optional(),
  reorder_point:              z.number().min(0).optional(),
  reorder_quantity:           z.number().min(0).optional(),
  max_stock:                  z.number().min(0).optional(),
  primary_supply_house_id:    z.string().uuid().optional(),
  secondary_supply_house_id:  z.string().uuid().optional(),
  is_active:                  z.boolean().optional(),
});

// POST /api/v1/materials
router.post(
  '/',
  requireRole('admin', 'warehouse_manager'),
  validate({ body: materialSchema }),
  async (req, res, next) => {
    try {
      const b = req.body;
      const { rows } = await query(
        `INSERT INTO materials
           (name, description, sku, barcode, unit_of_measure, department, category,
            st_pricebook_id, unit_cost, reorder_point, reorder_quantity, max_stock,
            primary_supply_house_id, secondary_supply_house_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [b.name, b.description, b.sku, b.barcode, b.unit_of_measure, b.department, b.category,
         b.st_pricebook_id, b.unit_cost, b.reorder_point, b.reorder_quantity, b.max_stock,
         b.primary_supply_house_id, b.secondary_supply_house_id],
      );
      res.status(201).json({ material: rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/v1/materials/:id
router.put(
  '/:id',
  requireRole('admin', 'warehouse_manager'),
  validate({ body: materialSchema.partial() }),
  async (req, res, next) => {
    try {
      const b = req.body;
      const { rows } = await query(
        `UPDATE materials
            SET name                      = COALESCE($1,  name),
                description               = COALESCE($2,  description),
                sku                       = COALESCE($3,  sku),
                barcode                   = COALESCE($4,  barcode),
                unit_of_measure           = COALESCE($5,  unit_of_measure),
                category                  = COALESCE($6,  category),
                st_pricebook_id           = COALESCE($7,  st_pricebook_id),
                unit_cost                 = COALESCE($8,  unit_cost),
                reorder_point             = COALESCE($9,  reorder_point),
                reorder_quantity          = COALESCE($10, reorder_quantity),
                max_stock                 = COALESCE($11, max_stock),
                primary_supply_house_id   = COALESCE($12, primary_supply_house_id),
                secondary_supply_house_id = COALESCE($13, secondary_supply_house_id),
                is_active                 = COALESCE($14, is_active),
                updated_at                = NOW()
          WHERE id = $15
          RETURNING *`,
        [b.name, b.description, b.sku, b.barcode, b.unit_of_measure, b.category,
         b.st_pricebook_id, b.unit_cost, b.reorder_point, b.reorder_quantity, b.max_stock,
         b.primary_supply_house_id, b.secondary_supply_house_id, b.is_active, req.params.id],
      );
      if (!rows[0]) return res.status(404).json({ error: 'Material not found' });
      res.json({ material: rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
