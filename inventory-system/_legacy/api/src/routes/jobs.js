'use strict';

/**
 * /jobs — ServiceTitan job list for scanner job-picker.
 *
 * Jobs are cached locally in the st_jobs table (populated by ST sync).
 * If ST credentials are configured a live pull is attempted first; the
 * cached rows are always the fallback.
 *
 * GET  /api/v1/jobs            — list jobs (filterable by truck_id, status, limit)
 * GET  /api/v1/jobs/:id        — single job
 */

const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { query } = require('../config/db');
const env = require('../config/env');

const router = Router();
router.use(requireAuth);

// GET /api/v1/jobs
// Query params: truck_id, status (comma-separated), limit (default 50), offset
router.get('/', async (req, res, next) => {
  try {
    const { truck_id, status, limit = 50, offset = 0 } = req.query;

    const conditions = [];
    const params = [];

    if (truck_id) {
      params.push(truck_id);
      conditions.push(`j.truck_id = $${params.length}`);
    }

    if (status) {
      // Support comma-separated status list: "in_progress,scheduled"
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        params.push(statuses[0]);
        conditions.push(`j.status = $${params.length}`);
      } else if (statuses.length > 1) {
        params.push(statuses);
        conditions.push(`j.status = ANY($${params.length})`);
      }
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(parseInt(limit), parseInt(offset));

    const { rows } = await query(
      `SELECT j.*,
              t.truck_number,
              u.first_name || ' ' || u.last_name AS technician_name
         FROM st_jobs j
         LEFT JOIN trucks t ON t.id = j.truck_id
         LEFT JOIN users u ON u.id = j.technician_id
        ${where}
        ORDER BY
          CASE j.status
            WHEN 'in_progress' THEN 0
            WHEN 'scheduled'   THEN 1
            ELSE 2
          END,
          j.scheduled_at ASC NULLS LAST,
          j.updated_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    res.json({ jobs: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/jobs/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT j.*,
              t.truck_number,
              u.first_name || ' ' || u.last_name AS technician_name
         FROM st_jobs j
         LEFT JOIN trucks t ON t.id = j.truck_id
         LEFT JOIN users u ON u.id = j.technician_id
        WHERE j.id = $1`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Job not found' });
    res.json({ job: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
