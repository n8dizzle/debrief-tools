'use strict';

/**
 * Weekly PO Run Job
 *
 * Scheduled: Monday 7:00 AM (configurable via WEEKLY_PO_CRON)
 *
 * Scans all warehouse_stock records where quantity_on_hand <= reorder_point,
 * groups items by warehouse + supply_house + department, and generates
 * draft Purchase Orders.
 *
 * Generated POs have status='draft' with an 8-hour review_deadline.
 * Managers review and send them via the /purchase-orders/:id/send endpoint.
 *
 * Logs result to scheduled_job_log.
 */

const { generateWeeklyPOs } = require('../services/poService');
const { query } = require('../config/db');

async function runWeeklyPO(trigger = 'scheduled') {
  const startedAt = new Date();
  console.log(`[${startedAt.toISOString()}] 📦 Weekly PO run starting (trigger: ${trigger})`);

  let result = { pos_created: 0, lines_added: 0 };
  let status = 'success';
  let errorDetail = null;

  try {
    result = await generateWeeklyPOs();
    console.log(`[WeeklyPO] Created ${result.pos_created} PO(s) with ${result.lines_added} line(s)`);
  } catch (err) {
    status = 'failed';
    errorDetail = err.message;
    console.error('[WeeklyPO] Error:', err.message);
  }

  await query(
    `INSERT INTO scheduled_job_log (job_type, status, detail, ran_at)
     VALUES ('po_run', $1, $2, NOW())`,
    [
      status,
      JSON.stringify({
        trigger,
        pos_created:  result.pos_created,
        lines_added:  result.lines_added,
        error:        errorDetail,
      }),
    ],
  ).catch((e) => console.error('[WeeklyPO] Failed to write job log:', e.message));

  return { ...result, status };
}

module.exports = { runWeeklyPO };
