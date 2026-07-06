import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

/**
 * GET /api/warranties?start&end&trade — warranty/recall analysis.
 *
 * Each warranty/recall job is linked back to the install that caused it (most-recent
 * non-warranty install at the SAME location before the warranty date). From that
 * originating install we get vintage (install date), the install lead (max-hours
 * crew member), contractor, and equipment — so warranties can be sliced by when it
 * was installed, who installed it, and what was installed. Root cause is pulled from
 * the service dashboard's investigations when present.
 */

const isWarranty = (t: string | null) => !!t && (/warranty/i.test(t) || /recall/i.test(t) || /callback/i.test(t));
const isInstall = (t: string | null) => !!t && /install/i.test(t) && !isWarranty(t);
const monthOf = (d: string | null) => (d || '').slice(0, 7);
const tradeOf = (bu: string | null) => /plumb/i.test(bu || '') ? 'plumbing' : 'hvac';
const daysBetween = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_view_jobs')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const tradeFilter = searchParams.get('trade') || '';
  const supabase = getServerSupabase();

  // All install-family jobs (installs + warranties) we might need. Pull a broad window
  // so a warranty in range can still find its (older) originating install.
  const { data: allJobs, error } = await supabase
    .from('ap_install_jobs')
    .select('id, st_job_id, st_location_id, job_type_name, business_unit_name, completed_date, customer_name, contractor_id, sold_by_name, component_count, system_count')
    .neq('job_status', 'Canceled')
    .or('is_ignored.is.null,is_ignored.eq.false')
    .not('completed_date', 'is', null)
    .gte('completed_date', '2024-01-01')
    .order('completed_date', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const jobs = allJobs || [];
  const installs = jobs.filter((j: any) => isInstall(j.job_type_name));
  let warranties = jobs.filter((j: any) => isWarranty(j.job_type_name));
  // Date + trade filter applies to the WARRANTY visit.
  if (start) warranties = warranties.filter((w: any) => w.completed_date >= start);
  if (end) warranties = warranties.filter((w: any) => w.completed_date <= end);
  if (tradeFilter) warranties = warranties.filter((w: any) => tradeOf(w.business_unit_name) === tradeFilter);

  // Installs by location, sorted ascending, for prior-install lookup.
  const installsByLoc = new Map<number, any[]>();
  for (const i of installs) {
    if (i.st_location_id == null) continue;
    if (!installsByLoc.has(i.st_location_id)) installsByLoc.set(i.st_location_id, []);
    installsByLoc.get(i.st_location_id)!.push(i);
  }
  const priorInstall = (w: any): any | null => {
    const list = w.st_location_id != null ? installsByLoc.get(w.st_location_id) : null;
    if (!list) return null;
    let best: any = null;
    for (const i of list) { if (i.completed_date <= w.completed_date) best = i; else break; }
    return best;
  };

  // Go-back rate: what share of installs we've had to return to. Uses ALL warranties
  // (any date — an install's warranties may fall outside the visit-date filter), trade-
  // filtered. goBackSet = the install ids that are some warranty's originating install.
  const warrAll = jobs.filter((j: any) => isWarranty(j.job_type_name))
    .filter((w: any) => !tradeFilter || tradeOf(w.business_unit_name) === tradeFilter);
  const goBackSet = new Set<string>();
  for (const w of warrAll) { const i = priorInstall(w); if (i) goBackSet.add(i.id); }
  const installsForRate = installs.filter((i: any) => !tradeFilter || tradeOf(i.business_unit_name) === tradeFilter);
  const totalInstalls = installsForRate.length;
  const goBackInstalls = installsForRate.filter((i: any) => goBackSet.has(i.id)).length;

  // Crew lead (max-hours, preferring HVAC Install - Lead) for the originating installs.
  const originIds = Array.from(new Set(warranties.map(priorInstall).filter(Boolean).map((i: any) => i.id)));
  const leadByInstall = new Map<string, string>();
  if (originIds.length) {
    const { data: leadTechs } = await supabase.from('ap_technicians').select('st_technician_id, name, is_install_lead');
    const nameByStId = new Map<number, string>((leadTechs || []).map((t: any) => [Number(t.st_technician_id), t.name]));
    const leadStIds = new Set<number>((leadTechs || []).filter((t: any) => t.is_install_lead).map((t: any) => Number(t.st_technician_id)));
    const { data: crew } = await supabase.from('ap_job_st_labor').select('job_id, st_technician_id, technician_name, hours').in('job_id', originIds).not('st_technician_id', 'is', null);
    const byJob = new Map<string, any[]>();
    for (const c of (crew || []) as any[]) { if (!byJob.has(c.job_id)) byJob.set(c.job_id, []); byJob.get(c.job_id)!.push(c); }
    for (const [jid, members] of byJob) {
      const leads = members.filter(m => leadStIds.has(Number(m.st_technician_id)));
      const pool = leads.length ? leads : members.filter(m => (m.technician_name || '') !== 'Install Team');
      if (!pool.length) continue;
      const lead = pool.reduce((a, b) => (Number(b.hours || 0) > Number(a.hours || 0) ? b : a));
      leadByInstall.set(jid, nameByStId.get(Number(lead.st_technician_id)) || lead.technician_name || '—');
    }
  }

  // Contractor names.
  const contractorIds = Array.from(new Set(warranties.map(priorInstall).filter(Boolean).map((i: any) => i.contractor_id).filter(Boolean)));
  const contractorName = new Map<string, string>();
  if (contractorIds.length) {
    const { data: cons } = await supabase.from('ap_contractors').select('id, name').in('id', contractorIds);
    for (const c of (cons || []) as any[]) contractorName.set(c.id, c.name);
  }

  // Equipment (make/type) at each warranty location — from the service dashboard cache.
  const locIds = Array.from(new Set(warranties.map((w: any) => w.st_location_id).filter(Boolean)));
  const equipByLoc = new Map<number, { manufacturer: string | null; type: string | null }>();
  if (locIds.length) {
    const { data: equip } = await supabase.from('sd_equipment').select('st_location_id, manufacturer, type, installed_on').in('st_location_id', locIds);
    // Keep the most-recently installed unit per location as representative.
    const latest = new Map<number, any>();
    for (const e of (equip || []) as any[]) {
      const cur = latest.get(e.st_location_id);
      if (!cur || (e.installed_on || '') > (cur.installed_on || '')) latest.set(e.st_location_id, e);
    }
    for (const [loc, e] of latest) equipByLoc.set(loc, { manufacturer: e.manufacturer || null, type: e.type || null });
  }

  // Root cause from investigations, keyed by the warranty's ST job id.
  const warrStIds = warranties.map((w: any) => w.st_job_id).filter(Boolean);
  const rootByStId = new Map<number, string>();
  if (warrStIds.length) {
    const { data: invs } = await supabase.from('sd_recall_investigations').select('st_recall_job_id, root_cause_category').in('st_recall_job_id', warrStIds).not('root_cause_category', 'is', null);
    for (const iv of (invs || []) as any[]) rootByStId.set(Number(iv.st_recall_job_id), iv.root_cause_category);
  }

  // Build linked pairs + aggregates.
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) || 0) + 1);
  const trend = new Map<string, number>();       // warranty month -> count
  const byLead = new Map<string, number>();
  const byContractor = new Map<string, number>();
  const byEquip = new Map<string, number>();
  const byRoot = new Map<string, number>();
  const ttwBuckets = { '0–30d': 0, '31–90d': 0, '91–180d': 0, '181–365d': 0, '365d+': 0 };
  let linked = 0, daysSum = 0, daysN = 0;
  const pairs: any[] = [];

  for (const w of warranties) {
    bump(trend, monthOf(w.completed_date));
    const inst = priorInstall(w);
    const root = w.st_job_id ? rootByStId.get(Number(w.st_job_id)) || null : null;
    if (root) bump(byRoot, root);
    const eq = w.st_location_id != null ? equipByLoc.get(w.st_location_id) : null;
    const eqLabel = eq ? [eq.manufacturer, eq.type].filter(Boolean).join(' ') || null : null;
    if (eqLabel) bump(byEquip, eqLabel);

    if (inst) {
      linked++;
      const days = daysBetween(w.completed_date, inst.completed_date);
      if (days >= 0) { daysSum += days; daysN++;
        if (days <= 30) ttwBuckets['0–30d']++; else if (days <= 90) ttwBuckets['31–90d']++;
        else if (days <= 180) ttwBuckets['91–180d']++; else if (days <= 365) ttwBuckets['181–365d']++; else ttwBuckets['365d+']++;
      }
      const lead = leadByInstall.get(inst.id);
      if (lead) bump(byLead, lead);
      if (inst.contractor_id) bump(byContractor, contractorName.get(inst.contractor_id) || 'Unknown');
      pairs.push({
        warranty_job: w.st_job_id, warranty_type: w.job_type_name, warranty_date: w.completed_date, customer: w.customer_name,
        trade: tradeOf(w.business_unit_name), install_job: inst.st_job_id, install_date: inst.completed_date, days,
        lead: lead || null, contractor: inst.contractor_id ? (contractorName.get(inst.contractor_id) || 'Unknown') : null,
        equipment: eqLabel, root_cause: root,
      });
    } else {
      pairs.push({ warranty_job: w.st_job_id, warranty_type: w.job_type_name, warranty_date: w.completed_date, customer: w.customer_name,
        trade: tradeOf(w.business_unit_name), install_job: null, install_date: null, days: null, lead: null, contractor: null, equipment: eqLabel, root_cause: root });
    }
  }

  const sortMap = (m: Map<string, number>, byKey = false) => Array.from(m.entries())
    .map(([k, v]) => ({ key: k, count: v })).sort((a, b) => byKey ? a.key.localeCompare(b.key) : b.count - a.count);

  // Go-back rate by install cohort: of installs completed each month, how many we've
  // had to return to at least once (distinct installs, not warranty visits).
  const instByMonth = new Map<string, { installs: number; went: number }>();
  for (const i of installsForRate) {
    const m = monthOf(i.completed_date);
    const cur = instByMonth.get(m) || { installs: 0, went: 0 };
    cur.installs++;
    if (goBackSet.has(i.id)) cur.went++;
    instByMonth.set(m, cur);
  }
  const cohortRows = Array.from(instByMonth.keys()).filter(m => m >= '2025-01').sort()
    .map(m => { const c = instByMonth.get(m)!; return { month: m, installs: c.installs, went_back: c.went, rate: c.installs > 0 ? Math.round((c.went / c.installs) * 1000) / 10 : null }; });

  return NextResponse.json({
    summary: {
      total: warranties.length, linked, unlinked: warranties.length - linked,
      link_pct: warranties.length ? Math.round((linked / warranties.length) * 100) : 0,
      avg_days_to_warranty: daysN ? Math.round(daysSum / daysN) : null,
      hvac: warranties.filter((w: any) => tradeOf(w.business_unit_name) === 'hvac').length,
      plumbing: warranties.filter((w: any) => tradeOf(w.business_unit_name) === 'plumbing').length,
      total_installs: totalInstalls,
      go_back_installs: goBackInstalls,
      go_back_rate: totalInstalls ? Math.round((goBackInstalls / totalInstalls) * 1000) / 10 : null,
    },
    trend: sortMap(trend, true),
    ttw: Object.entries(ttwBuckets).map(([key, count]) => ({ key, count })),
    cohort: cohortRows,
    by_lead: sortMap(byLead),
    by_contractor: sortMap(byContractor),
    by_equipment: sortMap(byEquip),
    by_root_cause: sortMap(byRoot),
    pairs: pairs.sort((a, b) => (b.warranty_date || '').localeCompare(a.warranty_date || '')),
  });
}
