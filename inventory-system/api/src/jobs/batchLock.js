'use strict';

/**
 * Batch Lock Job
 *
 * Scheduled: 6:00 AM daily (configurable via BATCH_LOCK_CRON)
 *
 * Locks all restock_batches with status='collecting', transitioning
 * them to 'locked' so warehouse managers can begin reviewing lines.
 *
 * Logs result to scheduled_job_log.
 */

const { lockAllCollectingBatches } = require('../services/restockService');
const { query } = require('../config/db');

async function runBatchLock(trigger = 'scheduled') {
  const startedAt = new Date();
  console.log(`[${startedAt.toISOString()}] 🔒 Batch lock job starting (trigger: ${trigger})`);

  let lockedBatches = [];
  let status = 'success';
  let errorDetail = null;

  try {
    lockedBatches = await lockAllCollectingBatches(trigger);
    console.log(`[BatchLock] Locked ${lockedBatches.length} batch(es)`);
  } catch (err) {
    status = 'failed';
    errorDetail = err.message;
    console.error('[BatchLock] Error:', err.message);
  }

  // Log to scheduled_job_log
  await query(
    `INSERT INTO scheduled_job_log (job_type, status, detail, ran_at)
     VALUES ('batch_lock', $1, $2, NOW())`,
    [
      status,
      JSON.stringify({
        trigger,
        locked_count: lockedBatches.length,
        batch_ids:    lockedBatches.map((b) => b.id),
        error:        errorDetail,
      }),
    ],
  ).catch((e) => console.error('[BatchLock] Failed to write job log:', e.message));

  return { locked: lockedBatches.length, status, batches: lockedBatches };
}

module.exports = { runBatchLock };
