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
// NOTE: root-cause-ai imports ROOT_CAUSE_CATEGORIES from this file; both usages are
// call-time only (inside functions), so this circular import resolves safely.
import { suggestRootCause, AI_MODEL_ID } from './root-cause-ai';

export const RECALL_RATE_MIN_JOBS = 10; // techs below this are hidden from the rate leaderboard

// Root-cause taxonomy SEED. As of 2026-07-07 the live taxonomy lives in the
// sd_recall_root_causes table (manager-editable from Settings). This constant is the
// fallback used to seed that table and as a safety net if the table is empty/unreachable
// (e.g. so the AI's strict-tool enum is never empty — an empty enum is an API error).
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
 * Active (non-archived) root-cause labels, ordered for display. This is what the picker
 * shows and what the AI is allowed to propose. Falls back to the seed constant if the
 * table is empty or unreachable so the picker/AI never break.
 */
export async function getActiveRootCauseCategories(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from('sd_recall_root_causes')
    .select('label')
    .is('archived_at', null)
    .order('sort_order', { ascending: true });
  const labels = (data || []).map(r => r.label as string).filter(Boolean);
  if (error || labels.length === 0) return [...ROOT_CAUSE_CATEGORIES];
  return labels;
}

/**
 * Every label ever defined (active + archived). Used to validate a cause being saved on an
 * investigation: an archived cause is still a valid thing to leave on a historical recall,
 * it just can't be freshly picked. Falls back to the seed constant on error.
 */
export async function getAllRootCauseLabels(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from('sd_recall_root_causes').select('label');
  const labels = (data || []).map(r => r.label as string).filter(Boolean);
  if (error || labels.length === 0) return [...ROOT_CAUSE_CATEGORIES];
  return labels;
}

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
  aiSuggested: number;
  errors: string[];
}

export interface SyncOptions {
  generateAi?: boolean; // default true — set false to skip the on-sync AI root-cause pass
  aiLimit?: number;     // max AI runs this call (default AI_RUNS_PER_SYNC)
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
  buMap: Map<number, { name: string }>,
  opts?: SyncOptions
): Promise<RecallSyncResult> {
  const errors: string[] = [];
  let recallsSynced = 0;
  let equipmentSynced = 0;
  let aiSuggested = 0;

  const recallJobs = await st.getAllRecallJobsCreatedInRange(startDate, endDate);
  if (recallJobs.length === 0) return { recallsSynced, equipmentSynced, aiSuggested, errors };

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
  // Equipment details kept in-memory so the AI pass below has manufacturer/model/type
  // without a re-fetch. Keyed by st_equipment_id.
  const equipmentDetailById = new Map<number, { manufacturer: string | null; model: string | null; type: string | null; installedOn: string | null }>();
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
        equipmentDetailById.set(e.id, {
          manufacturer: e.manufacturer ?? null, model: e.model ?? null, type: e.type ?? null,
          installedOn: e.installedOn ? formatLocalDate(new Date(e.installedOn)) : null,
        });
      }
    } catch (err) {
      // Equipment is best-effort — a failure here must not block recall sync (coverage is partial by design).
      errors.push(`Equipment fetch: ${(err as Error).message}`);
    }
  }

  // Customer names (crm/v2). Skip recalls that already have a name to avoid re-fetching every sync.
  const existingNames = new Map<number, string>();
  const recallIds = recallJobs.map(j => j.id);
  if (recallIds.length > 0) {
    const { data: ex } = await supabase.from('sd_recalls_caused').select('st_recall_job_id, customer_name').in('st_recall_job_id', recallIds);
    for (const r of (ex || [])) if (r.customer_name) existingNames.set(r.st_recall_job_id, r.customer_name);
  }
  const custNames = new Map<number, string>();
  const needCust = Array.from(new Set(
    recallJobs.filter(j => !existingNames.has(j.id) && j.customerId != null).map(j => j.customerId as number)
  ));
  for (const cid of needCust) {
    const c = await st.getCustomer(cid);
    if (c) custNames.set(cid, c.name);
  }

  // Recalls successfully upserted this run, with the context the AI pass needs below.
  const upserted: { recallJobId: number; originalId: number; trade: 'hvac' | 'plumbing' | null; buName: string | null; daysToRecall: number | null; equipmentId: number | null }[] = [];

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
        customer_name: existingNames.get(recall.id) || (recall.customerId != null ? custNames.get(recall.customerId) : null) || null,
        trade,
        st_location_id: recall.locationId ?? null,
        st_original_completed_date: origCompletedOn,
        days_to_recall: daysToRecall(origCompletedOn, recallCreatedOn),
        equipment_id: equipmentId,
      }, { onConflict: 'st_recall_job_id' });

    if (error) errors.push(`Recall ${recall.id}: ${error.message}`);
    else {
      recallsSynced++;
      upserted.push({
        recallJobId: recall.id, originalId,
        trade, buName,
        daysToRecall: daysToRecall(origCompletedOn, recallCreatedOn),
        equipmentId,
      });
    }
  }

  // ── Auto AI root-cause pass (best-effort; never blocks or fails the sync) ──
  // For every newly-synced recall WITHOUT an investigation yet, ask the AI for a
  // proposed root cause and persist it as 'ai_proposed'. The guess lands in
  // ai_root_cause_category only — root_cause_category stays null until a human validates.
  // Wrapped so that even a throw from its setup queries can never fail the overall sync
  // (this runs before other sync steps in the cron — it must not starve them).
  try {
    const aiResult = await generateAiForRecalls(supabase, st, upserted, opts);
    aiSuggested = aiResult.suggested;
    for (const e of aiResult.errors) errors.push(e);
  } catch (err) {
    errors.push(`AI root-cause pass failed (sync unaffected): ${(err as Error).message}`);
  }

  return { recallsSynced, equipmentSynced, aiSuggested, errors };
}

// Cap on AI runs per sync call — protects the Vercel function timeout on large windows
// (e.g. the backfill cron). When more recalls need AI than this, the rest are picked up
// on the next sync; we log the deferral rather than silently dropping it.
const AI_RUNS_PER_SYNC = 25;
const AI_CONCURRENCY = 4;
const AI_PER_RECALL_TIMEOUT_MS = 25_000; // bound wall-clock so a hung ST/Anthropic call can't stall the sync

// Reject if `p` doesn't settle within `ms`. Guards the nightly sync from a hung upstream call.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

/**
 * Runs the on-sync AI root-cause proposal for recalls that don't have an investigation.
 * Best-effort: any failure is recorded in errors and skipped, never thrown. Concurrency
 * is capped so a batch of new recalls doesn't blow the function timeout.
 */
async function generateAiForRecalls(
  supabase: SupabaseClient,
  st: ServiceTitanClient,
  upserted: { recallJobId: number; originalId: number; trade: 'hvac' | 'plumbing' | null; buName: string | null; daysToRecall: number | null; equipmentId: number | null }[],
  opts?: SyncOptions
): Promise<{ suggested: number; errors: string[] }> {
  const errors: string[] = [];
  if (opts?.generateAi === false || upserted.length === 0) return { suggested: 0, errors };
  if (!process.env.ANTHROPIC_API_KEY) return { suggested: 0, errors }; // AI not configured → skip silently

  // Only recalls without an existing investigation (idempotent — never re-proposes).
  const ids = upserted.map(u => u.recallJobId);
  const { data: existing } = await supabase
    .from('sd_recall_investigations').select('st_recall_job_id').in('st_recall_job_id', ids);
  const hasInvestigation = new Set((existing || []).map(r => r.st_recall_job_id));
  let todo = upserted.filter(u => !hasInvestigation.has(u.recallJobId));

  const limit = opts?.aiLimit ?? AI_RUNS_PER_SYNC;
  if (todo.length > limit) {
    errors.push(`AI root-cause: ${todo.length} recalls pending, ran ${limit} this sync (rest next run).`);
    todo = todo.slice(0, limit);
  }
  if (todo.length === 0) return { suggested: 0, errors };

  // Active taxonomy the AI may propose from (fetched once for the whole batch).
  const activeCategories = await getActiveRootCauseCategories(supabase);

  // Equipment details for the AI context (one query for the whole batch).
  const equipIds = Array.from(new Set(todo.map(u => u.equipmentId).filter((e): e is number => e != null)));
  const equipById = new Map<number, { manufacturer: string | null; model: string | null; type: string | null; installed_on: string | null }>();
  if (equipIds.length > 0) {
    const { data: eq } = await supabase.from('sd_equipment')
      .select('st_equipment_id, manufacturer, model, type, installed_on').in('st_equipment_id', equipIds);
    for (const e of (eq || [])) equipById.set(e.st_equipment_id, e);
  }

  let suggested = 0;
  // Simple bounded-concurrency runner (no dep): process `todo` in slices of AI_CONCURRENCY.
  for (let i = 0; i < todo.length; i += AI_CONCURRENCY) {
    const slice = todo.slice(i, i + AI_CONCURRENCY);
    const results = await Promise.all(slice.map(async (u) => {
      try {
        const [recallJob, recallNotes, origJob, origNotes] = await withTimeout(Promise.all([
          st.getJobById(u.recallJobId),
          st.getJobNotes(u.recallJobId),
          st.getJobById(u.originalId),
          st.getJobNotes(u.originalId),
        ]), AI_PER_RECALL_TIMEOUT_MS, `ST fetch for recall ${u.recallJobId}`);
        const eq = u.equipmentId != null ? equipById.get(u.equipmentId) : undefined;
        const suggestion = await withTimeout(suggestRootCause({
          trade: u.trade,
          jobType: null, // not captured at sync time (see design doc); left null intentionally
          daysToRecall: u.daysToRecall,
          businessUnit: u.buName,
          equipment: eq ? { manufacturer: eq.manufacturer, model: eq.model, type: eq.type, installedOn: eq.installed_on } : null,
          originalSummary: origJob?.summaryOfWork || origJob?.summary || null,
          recallSummary: recallJob?.summaryOfWork || recallJob?.summary || null,
          originalNotes: (origNotes || []).map(n => n.text),
          recallNotes: (recallNotes || []).map(n => n.text),
        }, activeCategories), AI_PER_RECALL_TIMEOUT_MS, `AI suggestion for recall ${u.recallJobId}`);
        const { error } = await supabase.from('sd_recall_investigations').upsert({
          st_recall_job_id: u.recallJobId,
          status: 'open',
          ai_root_cause_category: suggestion.root_cause_category,
          ai_rationale: suggestion.rationale,
          ai_evidence: suggestion.evidence,
          ai_confidence: suggestion.confidence,
          ai_model: AI_MODEL_ID,
          ai_generated_at: new Date().toISOString(),
          validation_state: 'ai_proposed',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'st_recall_job_id' });
        if (error) { errors.push(`AI recall ${u.recallJobId}: ${error.message}`); return 0; }
        return 1;
      } catch (err) {
        errors.push(`AI recall ${u.recallJobId}: ${(err as Error).message}`);
        return 0;
      }
    }));
    suggested += results.reduce<number>((a, b) => a + b, 0);
  }
  return { suggested, errors };
}
