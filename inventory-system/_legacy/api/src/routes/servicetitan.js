'use strict';

/**
 * ServiceTitan manual sync trigger routes
 *
 * POST /api/v1/st/sync/pricebook     — sync materials from ST pricebook
 * POST /api/v1/st/sync/equipment     — sync equipment records from ST
 * POST /api/v1/st/sync/technicians   — sync tech profiles from ST
 * POST /api/v1/st/sync/trucks        — sync vehicle records from ST
 * GET  /api/v1/st/sync/log           — recent sync history
 */

const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const stService = require('../services/stService');
const { query } = require('../config/db');

const router = Router();
router.use(requireAuth, requireRole('admin', 'warehouse_manager'));

// POST /api/v1/st/sync/pricebook
router.post('/sync/pricebook', async (_req, res, next) => {
  try {
    const result = await stService.syncPricebook();
    res.json({ message: 'Pricebook sync complete', result });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/st/sync/equipment
router.post('/sync/equipment', async (_req, res, next) => {
  try {
    const result = await stService.syncEquipment();
    res.json({ message: 'Equipment sync complete', result });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/st/sync/technicians
router.post('/sync/technicians', async (_req, res, next) => {
  try {
    const result = await stService.syncTechnicians();
    res.json({ message: 'Technician sync complete', result });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/st/sync/trucks
router.post('/sync/trucks', async (_req, res, next) => {
  try {
    const result = await stService.syncVehicles();
    res.json({ message: 'Truck sync complete', result });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/st/sync/log
router.get('/sync/log', async (req, res, next) => {
  try {
    const { sync_type, limit = 50 } = req.query;
    const conditions = sync_type ? [`sync_type = $1`] : [];
    const params = sync_type ? [sync_type, parseInt(limit)] : [parseInt(limit)];
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await query(
      `SELECT * FROM st_sync_log ${where} ORDER BY started_at DESC LIMIT $${params.length}`,
      params,
    );
    res.json({ log: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
