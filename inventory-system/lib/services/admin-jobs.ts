import 'server-only';
import { query } from '../db';
import { lockAllCollectingBatches } from './restock-batches';
import { generateWeeklyPOs } from './purchase-orders';

async function logJob(jobType: string, status: string, durationMs: number, result: Record<string, unknown> | null, errorMessage: string | null = null) {
  try {
    await query(
      `INSERT INTO scheduled_job_log (job_type, status, duration_ms, result, error_message, ran_at)
       VALUES ($1,$2,$3,$4::jsonb,$5,NOW())`,
      [jobType, status, durationMs, result ? JSON.stringify(result) : null, errorMessage],
    );
  } catch {
    // Table might not exist; non-fatal.
  }
}

export async function runBatchLock(trigger = 'manual') {
  const t0 = Date.now();
  try {
    const locked = await lockAllCollectingBatches(trigger);
    const result = { locked_count: locked.length, batches: locked };
    await logJob('batch_lock', 'success', Date.now() - t0, result);
    return result;
  } catch (e) {
    await logJob('batch_lock', 'failed', Date.now() - t0, null, (e as Error).message);
    throw e;
  }
}

export async function runWeeklyPO(_trigger = 'manual') {
  void _trigger;
  const t0 = Date.now();
  try {
    const result = await generateWeeklyPOs();
    await logJob('weekly_po', 'success', Date.now() - t0, result);
    return result;
  } catch (e) {
    await logJob('weekly_po', 'failed', Date.now() - t0, null, (e as Error).message);
    throw e;
  }
}
