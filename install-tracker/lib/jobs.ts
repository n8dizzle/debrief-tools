import { getServerSupabase } from '@/lib/supabase';
import type { Stage } from '@/lib/install-stages';

// Real install jobs, already synced from ServiceTitan into ap_install_jobs by
// ap-payments. Rung 6 reads that table directly — no live ST call needed.

export interface InstallJob {
  st_job_id: number;
  job_number: string | null;
  job_status: string | null;
  job_type_name: string | null;
  business_unit_name: string | null;
  customer_name: string | null;
  job_address: string | null;
  job_total: number | null;
  sold_on: string | null;
  sold_by_name: string | null;
  sold_estimate_job_number: string | null;
  component_count: number | null;
  system_count: number | null;
  scheduled_date: string | null;
  completed_date: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  payment_status: string | null;
  payment_paid_at: string | null;
  st_equipment_cost: number | null;
  st_project_id: number | null;
}

// This app tracks HVAC installs only (ap_install_jobs also holds Plumbing/Mims units).
const HVAC_INSTALL_UNIT = 'HVAC - Install';

const JOB_COLS =
  'st_job_id, job_number, job_status, job_type_name, business_unit_name, customer_name, job_address, ' +
  'job_total, sold_on, sold_by_name, sold_estimate_job_number, component_count, system_count, ' +
  'scheduled_date, completed_date, invoice_number, invoice_date, payment_status, payment_paid_at, ' +
  'st_equipment_cost, st_project_id';

// ServiceTitan deep links (same pattern the other apps use: go.servicetitan.com/#/…).
export const stJobUrl = (jobNumberOrId: string | number) => `https://go.servicetitan.com/#/Job/Index/${jobNumberOrId}`;
export const stProjectUrl = (projectId: number) => `https://go.servicetitan.com/#/Project/${projectId}`;

export async function getInstallJobs(limit = 60): Promise<InstallJob[]> {
  const supabase = getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from('ap_install_jobs')
    .select(JOB_COLS)
    .eq('is_ignored', false)
    .eq('business_unit_name', HVAC_INSTALL_UNIT)
    .order('synced_at', { ascending: false })
    .limit(limit);
  return ((data as unknown) as InstallJob[]) ?? [];
}

export async function getInstallJob(stJobId: number): Promise<InstallJob | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from('ap_install_jobs').select(JOB_COLS)
    .eq('st_job_id', stJobId)
    .eq('business_unit_name', HVAC_INSTALL_UNIT)
    .maybeSingle();
  return ((data as unknown) as InstallJob) ?? null;
}

// ---- Map a job's ServiceTitan data onto the (manager-defined) stages ----

export type StageSource = 'st' | 'partial' | 'manual';
export interface DetailRow {
  label: string;
  value: string;
  href?: string; // external link (e.g. into ServiceTitan)
}
export interface JobStage {
  name: string;
  status: 'done' | 'active' | 'wait' | 'gap';
  source: StageSource;
  value: string | null;      // the ST fact that fills this stage (collapsed line)
  note: string | null;       // why it's a manual gap, when applicable
  details: DetailRow[];      // expandable rows
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Format a 'YYYY-MM-DD' string without any timezone conversion (Central-safe).
export function fmtDate(ymd: string | null): string | null {
  if (!ymd) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return null;
  return `${MONTHS[m - 1]} ${d}`;
}
export function fmtMoney(n: number | null): string | null {
  if (n == null) return null;
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function isPaid(job: InstallJob): boolean {
  if (job.payment_paid_at) return true;
  const s = (job.payment_status || '').toLowerCase();
  return s === 'paid' || s === 'received' || s === 'completed';
}

function classify(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('sold')) return 'sold';
  if (n.includes('permit')) return 'permit';
  if (n.includes('equip')) return 'equipment';
  if (n.includes('schedul')) return 'scheduled';
  if (n.includes('install')) return 'installed';
  if (n.includes('inspect')) return 'inspection';
  if (n.includes('clos') || n.includes('paid') || n.includes('invoic')) return 'closed';
  return 'other';
}

// Derive a per-job view in the manager's own stage order.
export function deriveJobStages(stages: Stage[], job: InstallJob): JobStage[] {
  return stages.map((s) => {
    const kind = classify(s.name);
    const base = { name: s.name, status: 'gap' as JobStage['status'], source: 'manual' as StageSource, value: null as string | null, note: null as string | null, details: [] as DetailRow[] };

    switch (kind) {
      case 'sold': {
        const parts = [
          fmtDate(job.sold_on) && `Sold ${fmtDate(job.sold_on)}`,
          job.sold_estimate_job_number && `est #${job.sold_estimate_job_number}`,
          fmtMoney(job.job_total),
          job.system_count != null && `${job.system_count} system${job.system_count === 1 ? '' : 's'}`,
        ].filter(Boolean);
        const details: DetailRow[] = [
          { label: 'Sold by', value: job.sold_by_name || '—' },
          { label: 'Sold on', value: fmtDate(job.sold_on) || '—' },
          { label: 'Contract total', value: fmtMoney(job.job_total) || '—' },
          { label: 'Systems / components', value: `${job.system_count ?? '—'} / ${job.component_count ?? '—'}` },
        ];
        if (job.sold_estimate_job_number) {
          details.push({ label: 'Sold estimate', value: `#${job.sold_estimate_job_number} ↗`, href: stJobUrl(job.sold_estimate_job_number) });
        }
        details.push({ label: 'Note', value: 'One estimate shown. Multi-system deals can have several sold estimates — full multi-estimate view is pending an estimate-line pull from ServiceTitan.' });
        return { ...base, source: 'st', status: job.sold_on ? 'done' : 'wait', value: parts.join(' · ') || null, details };
      }
      case 'scheduled':
        return { ...base, source: 'st', status: job.scheduled_date ? 'done' : 'wait',
          value: fmtDate(job.scheduled_date) ? `Scheduled ${fmtDate(job.scheduled_date)}` : null,
          details: [{ label: 'Install date', value: fmtDate(job.scheduled_date) || '— (not scheduled)' }] };
      case 'installed': {
        const done = !!job.completed_date || (job.job_status || '').toLowerCase() === 'completed';
        return { ...base, source: 'st', status: done ? 'done' : job.scheduled_date ? 'active' : 'wait',
          value: fmtDate(job.completed_date) ? `Completed ${fmtDate(job.completed_date)}` : job.job_status,
          details: [
            { label: 'Completed', value: fmtDate(job.completed_date) || '— (not yet)' },
            { label: 'ServiceTitan status', value: job.job_status || '—' },
          ] };
      }
      case 'closed': {
        const paid = isPaid(job);
        const bits = [
          job.invoice_number && `Invoiced #${job.invoice_number}`,
          fmtDate(job.invoice_date) && `(${fmtDate(job.invoice_date)})`,
          paid ? 'paid' : job.payment_status ? `payment: ${job.payment_status.replace(/_/g, ' ')}` : null,
        ].filter(Boolean);
        return { ...base, source: 'partial', status: paid ? 'done' : job.invoice_number ? 'active' : 'wait',
          value: bits.join(' ') || null, note: 'Invoice from ServiceTitan; payment tracked in ap-payments.',
          details: [
            { label: 'Invoice #', value: job.invoice_number || '—' },
            { label: 'Invoice date', value: fmtDate(job.invoice_date) || '—' },
            { label: 'Payment', value: paid ? 'Paid' : job.payment_status ? job.payment_status.replace(/_/g, ' ') : '—' },
          ] };
      }
      case 'permit':
        return { ...base, note: 'ServiceTitan has no permit field — fill this in on the map.' };
      case 'equipment':
        return { ...base, note: 'ServiceTitan does not track ordered / delivered / staged — capture it here.' };
      case 'inspection':
        return { ...base, note: 'City inspection is not in ServiceTitan — where jobs silently stall.' };
      default:
        return { ...base, note: 'No ServiceTitan signal for this stage — manual.' };
    }
  });
}

export function jobCurrentStage(jobStages: JobStage[]): string {
  const active = jobStages.find((s) => s.status === 'active');
  if (active) return active.name;
  // else the last done stage, or first stage
  let last = jobStages[0]?.name ?? '—';
  for (const s of jobStages) if (s.status === 'done') last = s.name;
  return last;
}
