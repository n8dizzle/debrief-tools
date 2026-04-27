'use strict';

/**
 * Admin / Ops routes
 *
 * POST /api/v1/admin/jobs/batch-lock   — manually trigger the 6 AM batch lock
 * POST /api/v1/admin/jobs/po-run       — manually trigger the weekly PO run
 * GET  /api/v1/admin/jobs/log          — scheduled job execution history
 * GET  /api/v1/admin/stats/dashboard   — high-level inventory health stats
 */

const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { runBatchLock } = require('../jobs/batchLock');
const { runWeeklyPO } = require('../jobs/weeklyPO');
const { query } = require('../config/db');
const env = require('../config/env');

const router = Router();
router.use(requireAuth, requireRole('admin', 'manager'));

// POST /api/v1/admin/jobs/batch-lock
router.post('/jobs/batch-lock', async (_req, res, next) => {
  try {
    const result = await runBatchLock('manual');
    res.json({ message: 'Batch lock job executed', result });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/admin/jobs/po-run
router.post('/jobs/po-run', async (_req, res, next) => {
  try {
    const result = await runWeeklyPO('manual');
    res.json({ message: 'PO run executed', result });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/jobs/log
router.get('/jobs/log', async (req, res, next) => {
  try {
    const { job_type, limit = 100 } = req.query;
    const conditions = job_type ? [`job_type = $1`] : [];
    const params = job_type ? [job_type, parseInt(limit)] : [parseInt(limit)];
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await query(
      `SELECT * FROM scheduled_job_log ${where} ORDER BY ran_at DESC LIMIT $${params.length}`,
      params,
    );
    res.json({ log: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/stats/dashboard
router.get('/stats/dashboard', async (_req, res, next) => {
  try {
    const [materials, batches, pos, tools, assets] = await Promise.all([
      // Materials below reorder point
      query(`
        SELECT COUNT(DISTINCT m.id) AS below_reorder_count
          FROM materials m
          JOIN warehouse_stock ws ON ws.material_id = m.id
         WHERE ws.quantity_on_hand <= m.reorder_point AND m.is_active = TRUE
      `),
      // Open restock batches by status
      query(`
        SELECT status, COUNT(*) AS count
          FROM restock_batches
         WHERE status NOT IN ('completed', 'partially_completed')
         GROUP BY status
      `),
      // Open POs
      query(`
        SELECT status, COUNT(*) AS count
          FROM purchase_orders
         WHERE status NOT IN ('received', 'cancelled')
         GROUP BY status
      `),
      // Tools checked out
      query(`
        SELECT status, COUNT(*) AS count
          FROM tools
         WHERE is_active = TRUE
         GROUP BY status
      `),
      // IT assets
      query(`
        SELECT status, COUNT(*) AS count
          FROM it_assets
         WHERE is_active = TRUE
         GROUP BY status
      `),
      // Last sync
    ]);

    const lastSync = await query(`
      SELECT sync_type, status, started_at, records_synced
        FROM st_sync_log
       ORDER BY started_at DESC
       LIMIT 5
    `);

    res.json({
      materials_below_reorder: parseInt(materials.rows[0]?.below_reorder_count || 0),
      restock_batches: batches.rows,
      purchase_orders: pos.rows,
      tools: tools.rows,
      it_assets: assets.rows,
      last_st_syncs: lastSync.rows,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/admin/jobs/st-sync
// Pulls latest job list from ServiceTitan and upserts into st_jobs table.
router.post('/jobs/st-sync', async (_req, res, next) => {
  try {
    const stConfigured = env.st?.clientId && env.st.clientId !== 'placeholder';
    if (!stConfigured) {
      return res.json({
        ok: true,
        message: 'ServiceTitan credentials not configured — sync skipped.',
        synced: 0,
      });
    }

    const stService = require('../services/stService');
    const result = await stService.syncJobs();
    res.json({ ok: true, message: 'ST jobs sync triggered', result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
