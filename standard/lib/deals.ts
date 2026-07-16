import { getServerSupabase } from '@/lib/supabase';
import { deriveJobStages, type InstallJob } from '@/lib/jobs';
import type { Stage } from '@/lib/install-stages';
import { autoSignalFor, equipmentSignalFor, classifyStepSource, type AutoSignal, type EquipSignal, type StepSource } from '@/lib/step-source';

// A deal's assigned workflow (plus the two meta-states). "untriaged" = not yet routed;
// "archived" = deliberately not tracked. The rest are workflows.
export type TriageStatus = 'untriaged' | 'full_system' | 'partial' | 'warranty' | 'archived';
export type Workflow = 'full_system' | 'partial' | 'warranty';
export const WORKFLOW_LABEL: Record<string, string> = {
  full_system: 'Full System', partial: 'Partial', warranty: 'Warranty',
  other: 'Other', untriaged: 'Needs Triage', archived: 'Archived',
};

export interface Deal {
  st_project_id: number;
  triage_status: TriageStatus;
  suggested_class: 'full_system' | 'partial' | 'warranty' | 'other' | null;
  suggestion_reason: string | null;
  customer_name: string | null;
  primary_business_unit: string | null;
  sold_on: string | null;
  sold_estimate_count: number | null;
  equipment_unit_count: number | null; // = Components (real unit pieces)
  system_count: number | null;         // = complete systems
  contract_total: number | null;
  install_job_number: string | null;
  install_job_status: string | null;
  debrief_payment_type: string[]; // from the Estimate Debrief form; [] = none/blank → advisor to fill
}

const COLS =
  'st_project_id, triage_status, suggested_class, suggestion_reason, customer_name, ' +
  'primary_business_unit, sold_on, sold_estimate_count, equipment_unit_count, system_count, ' +
  'contract_total, install_job_number, install_job_status';

export async function getDeals(status: TriageStatus, max = 10000): Promise<Deal[]> {
  const supabase = getServerSupabase();
  if (!supabase) return [];
  // Supabase caps each response at ~1000 rows regardless of .limit(), so page
  // through with .range() until exhausted — otherwise filtering/bulk-triage
  // would act on an incomplete set.
  const PAGE = 1000;
  const all: Deal[] = [];
  for (let from = 0; from < max; from += PAGE) {
    const { data } = await supabase
      .from('install_deals')
      .select(COLS)
      .eq('triage_status', status)
      .order('sold_on', { ascending: false, nullsFirst: false })
      .order('st_project_id', { ascending: false })
      .range(from, from + PAGE - 1);
    const rows = ((data as unknown) as Deal[]) ?? [];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  const payMap = await getDebriefPayments(all.map((d) => d.st_project_id));
  for (const d of all) d.debrief_payment_type = payMap.get(d.st_project_id) ?? [];
  return all;
}

// Payment type per project from the Estimate Debrief form. A project can have several
// debriefs; take the payment type from the most recent submission that actually has one.
export async function getDebriefPayments(projectIds: number[]): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  const supabase = getServerSupabase();
  const ids = Array.from(new Set(projectIds.filter((n) => n != null)));
  if (!supabase || ids.length === 0) return out;
  const latest = new Map<number, string>(); // project → submitted_on of the chosen row
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300);
    const { data } = await supabase
      .from('install_debriefs')
      .select('st_project_id, payment_type, submitted_on')
      .in('st_project_id', chunk);
    for (const r of ((data as unknown) as { st_project_id: number; payment_type: string[] | null; submitted_on: string | null }[]) || []) {
      const pay = r.payment_type ?? [];
      if (pay.length === 0) continue;
      const when = r.submitted_on ?? '';
      if (!out.has(r.st_project_id) || when > (latest.get(r.st_project_id) ?? '')) {
        out.set(r.st_project_id, pay);
        latest.set(r.st_project_id, when);
      }
    }
  }
  return out;
}

export interface FullDeal extends Deal {
  customer_id: number | null;
  sold_by_name: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  invoice_balance: number | null;
  invoice_total: number | null;
  equip_signals: EquipSignals | null; // from the orders app (parts-equipment), keyed via ST estimate id
}

// Equipment-order signals for a deal, from the parts-equipment app (orders.christmasair.com).
// Aggregated across every install order linked to the deal's estimates. A deliberate,
// scoped cross-app read — the orders app is the only system of record for equipment
// ordering (ST tracks none of it). May be absorbed into this app later.
export interface EquipSignals {
  poConfirmed: boolean;   // every linked order has a PO cut (order_num or bo_ordered)
  ordered: boolean;       // every linked order moved off "Place Order"
  staged: boolean;        // every linked order is at the shop
  orderCount: number;
  locations: string[];    // distinct kanban locations, for evidence
  crew: string[];         // distinct install_team names (the crew/sub doing the install)
}

export async function getEquipmentSignals(projectId: number): Promise<EquipSignals | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;
  const { data: est } = await supabase.from('install_estimates').select('estimate_id').eq('st_project_id', projectId);
  const ids = ((est as unknown) as { estimate_id: number }[] || []).map((e) => e.estimate_id);
  if (ids.length === 0) return null;
  const { data: ord } = await supabase
    .from('pe_orders').select('location, order_num, bo_ordered, parts_ordered, parts_at_shop, install_team')
    .eq('order_type', 'install').in('st_estimate_id', ids);
  type O = { location: string | null; order_num: string | null; bo_ordered: boolean; parts_ordered: boolean; parts_at_shop: boolean; install_team: string | null };
  const os = ((ord as unknown) as O[]) || [];
  if (os.length === 0) return null;
  const moved = (l: string | null) => !!l && l !== 'Place Order';
  return {
    poConfirmed: os.every((o) => (o.order_num && o.order_num !== '') || o.bo_ordered),
    ordered: os.every((o) => moved(o.location) || o.parts_ordered),
    staged: os.every((o) => o.location === 'Lewisville Shop' || o.parts_at_shop),
    orderCount: os.length,
    locations: Array.from(new Set(os.map((o) => o.location).filter((l): l is string => !!l))),
    crew: Array.from(new Set(os.map((o) => (o.install_team || '').trim()).filter((t) => t !== ''))),
  };
}

export async function getDeal(projectId: number): Promise<FullDeal | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;
  const { data } = await supabase.from('install_deals').select('*').eq('st_project_id', projectId).maybeSingle();
  if (!data) return null;
  const deal = (data as unknown) as FullDeal;
  const [pay, equip] = await Promise.all([getDebriefPayments([projectId]), getEquipmentSignals(projectId)]);
  deal.debrief_payment_type = pay.get(projectId) ?? [];
  deal.equip_signals = equip;
  return deal;
}

// Derive the pipeline stages for a deal from OUR data (no ap_install_jobs). Reuses
// deriveJobStages by shaping the deal into the InstallJob fields it reads.
export function deriveDealStages(stages: Stage[], deal: FullDeal) {
  const paid = deal.invoice_number != null && deal.invoice_balance != null && deal.invoice_balance <= 0;
  const job: InstallJob = {
    st_job_id: 0,
    job_number: deal.install_job_number,
    job_status: deal.install_job_status,
    job_type_name: null,
    business_unit_name: deal.primary_business_unit,
    customer_name: deal.customer_name,
    job_address: null,
    job_total: deal.contract_total,
    sold_on: deal.sold_on,
    sold_by_name: deal.sold_by_name,
    sold_estimate_job_number: null,
    component_count: deal.equipment_unit_count,
    system_count: deal.system_count,
    scheduled_date: deal.scheduled_date,
    completed_date: deal.completed_date,
    invoice_number: deal.invoice_number,
    invoice_date: deal.invoice_date,
    payment_status: deal.invoice_number ? (paid ? 'paid' : 'open') : null,
    payment_paid_at: null,
    st_equipment_cost: null,
    st_project_id: deal.st_project_id,
  };
  return deriveJobStages(stages, job);
}

export const TRIAGE_STATUSES: TriageStatus[] = ['untriaged', 'full_system', 'partial', 'warranty', 'archived'];

// ---- Phase 2: per-deal sub-step checklist ----

export interface PipelineSubStep {
  id: string | null;
  title: string;
  detail: string;
  auto: boolean;            // true = ServiceTitan-derived, read-only (locked). false = checkbox.
  tag: 'auto' | 'manual' | 'orders'; // signal source shown to the user
  source: StepSource;       // where the signal comes from (servicetitan | orders | debrief | manual)
  done: boolean;            // effective state
  evidence: string | null;  // the fact that satisfied it (ST or orders app)
}
export interface PipelineStage {
  stageId: string | null;
  name: string;
  status: 'done' | 'active' | 'wait' | 'na';
  subSteps: PipelineSubStep[];
  isSold: boolean;
  gated: boolean;        // conditional stage that can be marked "Not required" for a job
  notRequired: boolean;  // the gate is set to not_required → stage closed as N/A
}

// Stages that don't apply to every job. A human sets a Required?/Not-required gate; when
// "Not required" the stage closes as N/A. Hardcoded for now (like the auto-signal matcher).
function isGatedStage(name: string): boolean {
  return /permit|inspection/i.test(name || '');
}

// The Equipment stage keys off the orders app (auto-with-override). equipmentSignalFor is
// imported from step-source (shared with the workflow map).
function equipAuto(sig: EquipSignal, es: EquipSignals | null): { done: boolean; evidence: string | null } {
  if (!es) return { done: false, evidence: null };
  const locs = es.locations.join(', ');
  if (sig === 'po_confirmed') return { done: es.poConfirmed, evidence: es.poConfirmed ? 'PO cut in orders app' : null };
  if (sig === 'ordered') return { done: es.ordered, evidence: es.ordered ? (locs || 'ordered') : null };
  return { done: es.staged, evidence: es.staged ? (locs || 'at shop') : null };
}

// autoSignalFor is imported from step-source (shared with the workflow map).
function autoState(signal: AutoSignal, deal: FullDeal): { done: boolean; evidence: string | null } {
  switch (signal) {
    case 'sold': return { done: !!deal.sold_on, evidence: deal.sold_on ? `sold ${deal.sold_on}` : null };
    case 'job': return { done: !!deal.install_job_number, evidence: deal.install_job_number ? `job #${deal.install_job_number}` : null };
    case 'scheduled': return { done: !!deal.scheduled_date, evidence: deal.scheduled_date ? `scheduled ${deal.scheduled_date}` : null };
    case 'installed': return { done: !!deal.completed_date, evidence: deal.completed_date ? `completed ${deal.completed_date}` : null };
    case 'invoiced': return { done: !!deal.invoice_number, evidence: deal.invoice_number ? `invoice #${deal.invoice_number}` : null };
    case 'paid': { const p = deal.invoice_number != null && deal.invoice_balance != null && deal.invoice_balance <= 0; return { done: p, evidence: p ? 'balance $0' : null }; }
    case 'payment_type': { const has = deal.debrief_payment_type.length > 0; return { done: has, evidence: has ? deal.debrief_payment_type.join(', ') : null }; }
  }
}

type StepStatus = { done: boolean; note: string | null; state: string | null };

export async function getDealStepStatus(projectId: number): Promise<Map<string, StepStatus>> {
  const m = new Map<string, StepStatus>();
  const supabase = getServerSupabase();
  if (!supabase) return m;
  const { data } = await supabase.from('install_deal_steps').select('node_id, done, note, state').eq('st_project_id', projectId);
  for (const r of ((data as unknown) as { node_id: string; done: boolean; note: string | null; state: string | null }[]) || []) {
    m.set(r.node_id, { done: r.done, note: r.note, state: r.state });
  }
  return m;
}

// Build the per-deal checklist: each sub-step's done state (auto from ST, manual from
// stored status), each stage's status rolled up from its sub-steps, and the N/A gate for
// conditional stages (Permit, Inspection).
export function deriveDealPipeline(
  stages: Stage[], deal: FullDeal, status: Map<string, StepStatus>,
): PipelineStage[] {
  return stages.map((s) => {
    const gated = isGatedStage(s.name);
    const isEquip = /equipment/i.test(s.name);
    const notRequired = gated && (s.id ? status.get(s.id)?.state : undefined) === 'not_required';
    // On a gated stage the header Required? gate replaces the "determine if needed" sub-step.
    const src = gated ? s.subSteps.filter((ss) => !/determine if .*need/i.test(ss.title)) : s.subSteps;

    const subSteps: PipelineSubStep[] = src.map((ss) => {
      const source = classifyStepSource(s.name, ss.title).source; // where this step's signal comes from
      // Equipment stage: auto-tick from the orders app, but a manager can override by hand.
      const equipSig = isEquip ? equipmentSignalFor(ss.title) : null;
      if (equipSig) {
        const a = equipAuto(equipSig, deal.equip_signals);
        const override = ss.id ? status.get(ss.id) : undefined;
        const done = override ? override.done : a.done;
        const evidence = override ? 'set by hand' : a.evidence;
        return { id: ss.id ?? null, title: ss.title, detail: ss.detail, auto: false, tag: 'orders', source, done, evidence };
      }
      // "Crew assigned" (Scheduled): auto from the orders app's install_team, with override.
      if (/crew assigned/i.test(ss.title)) {
        const crew = deal.equip_signals?.crew ?? [];
        const override = ss.id ? status.get(ss.id) : undefined;
        const done = override ? override.done : crew.length > 0;
        const evidence = override ? 'set by hand' : (crew.length ? crew.join(', ') : null);
        return { id: ss.id ?? null, title: ss.title, detail: ss.detail, auto: false, tag: 'orders', source, done, evidence };
      }
      const sig = autoSignalFor(ss.title);
      if (sig) {
        const a = autoState(sig, deal);
        return { id: ss.id ?? null, title: ss.title, detail: ss.detail, auto: true, tag: 'auto', source, done: a.done, evidence: a.evidence };
      }
      const st = ss.id ? status.get(ss.id) : undefined;
      return { id: ss.id ?? null, title: ss.title, detail: ss.detail, auto: false, tag: 'manual', source, done: !!st?.done, evidence: null };
    });

    const base = { stageId: s.id ?? null, name: s.name, subSteps, isSold: s.name.toLowerCase().includes('sold'), gated };
    if (notRequired) return { ...base, status: 'na' as const, notRequired: true };

    const doneCount = subSteps.filter((x) => x.done).length;
    const stStatus: PipelineStage['status'] =
      subSteps.length === 0 ? 'wait' : doneCount === subSteps.length ? 'done' : doneCount > 0 ? 'active' : 'wait';
    return { ...base, status: stStatus, notRequired: false };
  });
}

export async function getTriageCounts(): Promise<Record<TriageStatus, number>> {
  const supabase = getServerSupabase();
  const out: Record<TriageStatus, number> = { untriaged: 0, full_system: 0, partial: 0, warranty: 0, archived: 0 };
  if (!supabase) return out;
  for (const s of TRIAGE_STATUSES) {
    const { count } = await supabase
      .from('install_deals').select('*', { count: 'exact', head: true }).eq('triage_status', s);
    out[s] = count ?? 0;
  }
  return out;
}
