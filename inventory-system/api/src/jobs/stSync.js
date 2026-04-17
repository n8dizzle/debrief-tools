'use strict';

/**
 * ServiceTitan Sync Job
 *
 * Scheduled: Every 4 hours (configurable via ST_SYNC_CRON)
 *
 * Runs all ST sync operations in sequence:
 *   1. Pricebook → materials
 *   2. Equipment
 *   3. Technicians → users
 *   4. Vehicles → trucks
 *
 * Individual sync failures are caught and logged — one failure
 * does not abort the remaining syncs.
 */

const stService = require('../services/stService');

async function runSTSync() {
  const startedAt = new Date();
  console.log(`[${startedAt.toISOString()}] 🔄 ServiceTitan sync starting`);

  const results = {};
  const errors  = {};

  const syncJobs = [
    { name: 'pricebook',    fn: stService.syncPricebook },
    { name: 'equipment',    fn: stService.syncEquipment },
    { name: 'technicians',  fn: stService.syncTechnicians },
    { name: 'vehicles',     fn: stService.syncVehicles },
  ];

  for (const { name, fn } of syncJobs) {
    try {
      results[name] = await fn();
      console.log(`[STSync] ${name}: ${results[name].synced} synced, ${results[name].failed} failed`);
    } catch (err) {
      errors[name] = err.message;
      console.error(`[STSync] ${name} error:`, err.message);
    }
  }

  const duration = ((Date.now() - startedAt.getTime()) / 1000).toFixed(1);
  console.log(`[STSync] Completed in ${duration}s. Errors: ${Object.keys(errors).length}`);

  return { results, errors, duration_seconds: duration };
}

module.exports = { runSTSync };
