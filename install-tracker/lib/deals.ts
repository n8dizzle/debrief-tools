import { getServerSupabase } from '@/lib/supabase';
import { deriveJobStages, type InstallJob } from '@/lib/jobs';
import type { Stage } from '@/lib/install-stages';

export type TriageStatus = 'untriaged' | 'install' | 'archived';

export interface Deal {
  st_project_id: number;
  triage_status: TriageStatus;
  suggested_class: 'install' | 'other' | 'warranty' | null;
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
  return all;
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
}

export async function getDeal(projectId: number): Promise<FullDeal | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;
  const { data } = await supabase.from('install_deals').select('*').eq('st_project_id', projectId).maybeSingle();
  return ((data as unknown) as FullDeal) ?? null;
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

export async function getTriageCounts(): Promise<Record<TriageStatus, number>> {
  const supabase = getServerSupabase();
  const out: Record<TriageStatus, number> = { untriaged: 0, install: 0, archived: 0 };
  if (!supabase) return out;
  for (const s of ['untriaged', 'install', 'archived'] as TriageStatus[]) {
    const { count } = await supabase
      .from('install_deals').select('*', { count: 'exact', head: true }).eq('triage_status', s);
    out[s] = count ?? 0;
  }
  return out;
}
