import { getServerSupabase } from '@/lib/supabase';

export type TriageStatus = 'untriaged' | 'install' | 'archived';

export interface Deal {
  st_project_id: number;
  triage_status: TriageStatus;
  suggested_class: 'install' | 'other' | null;
  suggestion_reason: string | null;
  customer_name: string | null;
  primary_business_unit: string | null;
  sold_on: string | null;
  sold_estimate_count: number | null;
  equipment_unit_count: number | null;
  contract_total: number | null;
  install_job_number: string | null;
  install_job_status: string | null;
}

const COLS =
  'st_project_id, triage_status, suggested_class, suggestion_reason, customer_name, ' +
  'primary_business_unit, sold_on, sold_estimate_count, equipment_unit_count, contract_total, ' +
  'install_job_number, install_job_status';

export async function getDeals(status: TriageStatus, limit = 1200): Promise<Deal[]> {
  const supabase = getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from('install_deals')
    .select(COLS)
    .eq('triage_status', status)
    .order('sold_on', { ascending: false, nullsFirst: false })
    .limit(limit);
  return ((data as unknown) as Deal[]) ?? [];
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
