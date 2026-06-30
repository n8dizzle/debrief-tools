// Quality / Recalls (QC) — shared logic for the Recalls section.
//
// Detection uses ServiceTitan's native recall link: a job with recallForId != null
// is a recall, and recallForId is the original job's id (see lib/servicetitan.ts
// getAllRecallJobsCreatedInRange). This is the SAME mechanism the leaderboard's
// "recalls caused" metric uses — we widen it to ALL business units + long history.
//
// BLAST RADIUS: sd_recalls_caused is read by app/api/leaderboard/route.ts. Because we
// now write recalls for ALL business units, each row is tagged is_service_bu at write
// time, and the leaderboard query filters to is_service_bu (NULL = legacy service rows).
// countsForLeaderboard() below is the single source of that predicate and is unit-tested
// as a regression guard. "Widen the data, narrow the read."

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ServiceTitanClient, STJob } from './servicetitan';
import { formatLocalDate } from './sd-utils';

export const RECALL_RATE_MIN_JOBS = 10; // techs below this are hidden from the rate leaderboard

// Phase-1 root-cause taxonomy (constrained so it rolls up in Trends). Editable later.
export const ROOT_CAUSE_CATEGORIES = [
  'Install error / workmanship',
  'Misdiagnosis',
  'Defective equipment or part',
  'Wrong part or sizing',
  'Incomplete repair',
  'Customer misuse or unrelated',
  'Maintenance-related',
  'Other',
] as const;
export type RootCauseCategory = (typeof ROOT_CAUSE_CATEGORIES)[number];

/**
 * Server-side permission check for the Recalls section. owner + manager always pass;
 * others need the explicit service_dashboard grant. perm = 'view' | 'investigate'.
 */
export function hasRecallPermission(session: unknown, perm: 'view' | 'investigate'): boolean {
  const user = (session as { user?: { role?: string; permissions?: { service_dashboard?: Record<string, boolean> } } } | null)?.user;
  if (!user) return false;
  if (user.role === 'owner' || user.role === 'manager') return true;
  const p = user.permissions?.service_dashboard;
  return perm === 'view' ? p?.can_view_recalls === true : p?.can_investigate === true;
}

// ── Pure functions (unit-tested in lib/qc-recalls.test.ts) ──

/**
 * The leaderboard "recalls caused" metric counts ONLY service-business-unit recalls.
 * Legacy rows (synced before the QC widening) have is_service_bu = null and were all
 * service-BU, so they count. Install / non-service recalls (is_service_bu = false) do not.
 * This predicate must mirror the .or() filter in app/api/leaderboard/route.ts exactly.
 */
export function countsForLeaderboard(row: { is_service_bu: boolean | null }): boolean {
  return row.is_service_bu === null || row.is_service_bu === true;
}

/**
 * Recall RATE for a tech over a period: recalls (caused, in-period) / jobs completed
 * (in-period). Returns null when the tech is below the minimum-jobs threshold or has
 * no completed jobs — the UI renders null as "—" rather than a misleading 0% or 100%.
 */
export function computeRecallRate(
  recallCount: number,
  completedJobs: number,
  minJobs: number = RECALL_RATE_MIN_JOBS
): number | null {
  if (completedJobs < minJobs || completedJobs <= 0) return null;
  return recallCount / completedJobs;
}

/**
 * Whole days between the original job's completion and the recall's creation.
 * Null when the original completion date is unknown (original purged / not found) —
 * the recall is still valid, time-to-recall is just "—".
 */
export function daysToRecall(
  originalCompletedOn: string | Date | null | undefined,
  recallCreatedOn: string | Date | null | undefined
): number | null {
  if (!originalCompletedOn || !recallCreatedOn) return null;
  const o = new Date(originalCompletedOn).getTime();
  const r = new Date(recallCreatedOn).getTime();
  if (Number.isNaN(o) || Number.isNaN(r)) return null;
  const d = Math.floor((r - o) / 86_400_000);
  return d >= 0 ? d : null; // negative = data anomaly, treat as unknown
}

/** Time-to-recall bucket label for the distribution panel. */
export function timeToRecallBucket(days: number | null): '≤7d' | '8–30d' | '31–90d' | '90d+' | 'unknown' {
  if (days === null) return 'unknown';
  if (days <= 7) return '≤7d';
  if (days <= 30) return '8–30d';
  if (days <= 90) return '31–90d';
  return '90d+';
}

// ── Sync helper (called by both cron/sync and settings/sync — DRY) ──

export interface RecallSyncResult {
  recallsSynced: number;
  equipmentSynced: number;
  errors: string[];
}

/**
 * Widened recall sync: pulls recalls across ALL business units for the window,
 * attributes each to the ORIGINAL job's tech, enriches with location / trade /
 * days-to-recall / equipment, tags is_service_bu, and upserts into sd_recalls_caused.
 * Also caches installed equipment for the recall locations into sd_equipment.
 */
export async function syncRecalls(
  supabase: SupabaseClient,
  st: ServiceTitanClient,
  startDate: string,
  endDate: string,
  serviceBUIds: number[],
  buMap: Map<number, { name: string }>
): Promise<RecallSyncResult> {
  const errors: string[] = [];
  let recallsSynced = 0;
  let equipmentSynced = 0;

  const recallJobs = await st.getAllRecallJobsCreatedInRange(startDate, endDate);
  if (recallJobs.length === 0) return { recallsSynced, equipmentSynced, errors };

  const serviceBUSet = new Set(serviceBUIds);

  // Resolve original-job tech + completion date (cache hits from sd_completed_jobs first).
  const originalIds = Array.from(
    new Set(recallJobs.map(j => j.recallForId!).filter((id): id is number => id != null))
  );
  const origTech = new Map<number, number | null>();
  const origCompleted = new Map<number, string | null>();
  if (originalIds.length > 0) {
    const { data: locals } = await supabase
      .from('sd_completed_jobs')
      .select('st_job_id, st_technician_id, completed_date')
      .in('st_job_id', originalIds);
    for (const row of (locals || [])) {
      origTech.set(row.st_job_id, row.st_technician_id);
      origCompleted.set(row.st_job_id, row.completed_date);
    }
  }

  // Equipment for recall locations (locationIds plural filter works — no fetch-all workaround).
  const locationIds = Array.from(new Set(recallJobs.map(j => j.locationId).filter((l): l is number => l != null)));
  const equipmentByLocation = new Map<number, { st_equipment_id: number }[]>();
  if (locationIds.length > 0) {
    try {
      const equipment = await st.getInstalledEquipmentByLocations(locationIds);
      for (const e of equipment) {
        const { error } = await supabase.from('sd_equipment').upsert({
          st_equipment_id: e.id,
          st_location_id: e.locationId,
          st_customer_id: e.customerId ?? null,
          name: e.name ?? null,
          manufacturer: e.manufacturer ?? null,
          model: e.model ?? null,
          type: e.type ?? null,
          serial_number: e.serialNumber ?? null,
          installed_on: e.installedOn ? formatLocalDate(new Date(e.installedOn)) : null,
          cost: e.cost ?? null,
          synced_at: new Date().toISOString(),
        }, { onConflict: 'st_equipment_id' });
        if (error) { errors.push(`Equipment ${e.id}: ${error.message}`); continue; }
        equipmentSynced++;
        if (!equipmentByLocation.has(e.locationId)) equipmentByLocation.set(e.locationId, []);
        equipmentByLocation.get(e.locationId)!.push({ st_equipment_id: e.id });
      }
    } catch (err) {
      // Equipment is best-effort — a failure here must not block recall sync (coverage is partial by design).
      errors.push(`Equipment fetch: ${(err as Error).message}`);
    }
  }

  for (const recall of recallJobs) {
    const originalId = recall.recallForId!;
    let causedByTechId = origTech.get(originalId);
    if (causedByTechId === undefined) {
      causedByTechId = await st.getTechForJobId(originalId);
      origTech.set(originalId, causedByTechId);
    }
    if (causedByTechId == null) continue; // can't attribute → skip (matches existing behavior)

    // Original completion date for days-to-recall (cache, else fetch the original job).
    let origCompletedOn = origCompleted.get(originalId);
    if (origCompletedOn === undefined) {
      const origJob = await st.getJobById(originalId);
      origCompletedOn = origJob?.completedOn ? formatLocalDate(new Date(origJob.completedOn)) : null;
      origCompleted.set(originalId, origCompletedOn);
    }

    const recallCreatedOn = recall.createdOn ? formatLocalDate(new Date(recall.createdOn)) : endDate;
    const buName = buMap.get(recall.businessUnitId)?.name || null;
    const trade = buName ? st.getTradeFromBUName(buName) : null;
    const equipForLoc = recall.locationId != null ? equipmentByLocation.get(recall.locationId) : undefined;
    const equipmentId = equipForLoc && equipForLoc.length > 0 ? equipForLoc[0].st_equipment_id : null;

    const { error } = await supabase
      .from('sd_recalls_caused')
      .upsert({
        st_recall_job_id: recall.id,
        st_original_job_id: originalId,
        caused_by_tech_id: causedByTechId,
        recall_created_on: recallCreatedOn,
        business_unit_name: buName,
        business_unit_id: recall.businessUnitId ?? null,
        is_service_bu: serviceBUSet.has(recall.businessUnitId),
        trade,
        st_location_id: recall.locationId ?? null,
        st_original_completed_date: origCompletedOn,
        days_to_recall: daysToRecall(origCompletedOn, recallCreatedOn),
        equipment_id: equipmentId,
      }, { onConflict: 'st_recall_job_id' });

    if (error) errors.push(`Recall ${recall.id}: ${error.message}`);
    else recallsSynced++;
  }

  return { recallsSynced, equipmentSynced, errors };
}
