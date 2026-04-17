'use strict';

/**
 * Scheduler bootstrap
 *
 * Registers all cron jobs using node-cron.
 * Cron schedules are configurable via environment variables.
 *
 * All times are in the timezone of the server process.
 * To pin to a specific timezone, set TZ=America/Chicago in the environment.
 */

const cron = require('node-cron');
const env  = require('../config/env');
const { runBatchLock } = require('./batchLock');
const { runWeeklyPO }  = require('./weeklyPO');
const { runSTSync }    = require('./stSync');

function startScheduler() {
  // ──────────────────────────────────────────────────────────────────────
  // 1. Batch Lock — 6:00 AM daily
  //    Locks all 'collecting' restock batches so managers can review.
  // ──────────────────────────────────────────────────────────────────────
  if (cron.validate(env.crons.batchLock)) {
    cron.schedule(env.crons.batchLock, () => {
      runBatchLock('scheduled').catch((err) => {
        console.error('[Scheduler] Batch lock failed:', err.message);
      });
    });
    console.log(`⏰ Batch lock scheduled: ${env.crons.batchLock}`);
  } else {
    console.error(`❌ Invalid BATCH_LOCK_CRON expression: ${env.crons.batchLock}`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // 2. Weekly PO Run — Monday 7:00 AM
  //    Generates draft POs for all materials below reorder point.
  // ──────────────────────────────────────────────────────────────────────
  if (cron.validate(env.crons.weeklyPO)) {
    cron.schedule(env.crons.weeklyPO, () => {
      runWeeklyPO('scheduled').catch((err) => {
        console.error('[Scheduler] Weekly PO run failed:', err.message);
      });
    });
    console.log(`⏰ Weekly PO run scheduled: ${env.crons.weeklyPO}`);
  } else {
    console.error(`❌ Invalid WEEKLY_PO_CRON expression: ${env.crons.weeklyPO}`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // 3. ServiceTitan Sync — every 4 hours
  // ──────────────────────────────────────────────────────────────────────
  if (cron.validate(env.crons.stSync)) {
    cron.schedule(env.crons.stSync, () => {
      runSTSync().catch((err) => {
        console.error('[Scheduler] ST sync failed:', err.message);
      });
    });
    console.log(`⏰ ST sync scheduled: ${env.crons.stSync}`);
  } else {
    console.error(`❌ Invalid ST_SYNC_CRON expression: ${env.crons.stSync}`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // 4. Bin Alert Check — every hour
  //    Placeholder: extend to notify managers of stale bins
  // ──────────────────────────────────────────────────────────────────────
  if (cron.validate(env.crons.binAlert)) {
    cron.schedule(env.crons.binAlert, async () => {
      try {
        const { query } = require('../config/db');
        // Alert on bins that have been 'pending_scan' for more than 24 hours
        const { rows } = await query(
          `SELECT tb.id, tb.bin_label, u.first_name || ' ' || u.last_name AS tech_name,
                  MIN(bi.placed_at) AS oldest_item_at
             FROM tech_bins tb
             JOIN users u ON u.id = tb.technician_id
             JOIN bin_items bi ON bi.bin_id = tb.id AND bi.scanned_at IS NULL
            WHERE tb.status = 'pending_scan'
              AND bi.placed_at < NOW() - INTERVAL '24 hours'
            GROUP BY tb.id, tb.bin_label, u.first_name, u.last_name`,
        );

        if (rows.length > 0) {
          console.warn(`[BinAlert] ${rows.length} bin(s) have been pending scan for >24h:`,
            rows.map((r) => `${r.bin_label} (${r.tech_name})`).join(', '));

          await query(
            `INSERT INTO scheduled_job_log (job_type, status, detail)
             VALUES ('bin_alert_check', 'success', $1)`,
            [JSON.stringify({ stale_bins: rows.length, bins: rows.map((r) => r.bin_label) })],
          );
        }
      } catch (err) {
        console.error('[Scheduler] Bin alert check failed:', err.message);
      }
    });
    console.log(`⏰ Bin alert check scheduled: ${env.crons.binAlert}`);
  }
}

module.exports = { startScheduler };
