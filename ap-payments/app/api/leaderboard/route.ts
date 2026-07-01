import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

/**
 * GET /api/leaderboard?start&end — lead-installer leaderboard, styled after the service
 * dashboard: each installer is ranked in every metric, ranks become percentiles, and a
 * weighted average is the overall score.
 *
 * Lead attribution: each HVAC-Install job (by completed_date) is credited to ONE lead —
 * the crew member with the most clocked hours on it. That job's revenue + total crew
 * hours accrue to the lead.
 *
 * Metrics: Revenue installed ($), Rev/Labor-Hr (efficiency), Recalls caused (lower is
 * better, from sd_recalls_caused), Review mentions (google_reviews.team_members_mentioned).
 */

// Default weights (sum to 1). TODO: make configurable in Settings, like sd_scoring_config.
const WEIGHTS = { revenue: 0.35, efficiency: 0.25, recalls: 0.20, reviews: 0.20 };

interface Entry {
  st_technician_id: number;
  name: string;
  home_team: string | null;
  jobs_led: number;
  revenue: number;
  hours: number;          // total crew hours across led jobs (efficiency denominator)
  rev_per_hour: number;
  components: number;         // total components installed across led jobs
  hours_per_component: number; // crew hours ÷ components (only over jobs with a component count)
  recalls: number;
  reviews: number;
  score: number;
  rank: number;
  breakdown: { revenue: number; efficiency: number; recalls: number; reviews: number };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_view_jobs')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const supabase = getServerSupabase();

  // 1) Install jobs in range.
  let jq = supabase
    .from('ap_install_jobs')
    .select('id, st_revenue, job_total, component_count')
    .eq('business_unit_name', 'HVAC - Install')
    .neq('job_status', 'Canceled')
    .or('is_ignored.is.null,is_ignored.eq.false');
  if (start) jq = jq.gte('completed_date', start);
  if (end) jq = jq.lte('completed_date', end);
  const { data: jobs, error: jobsErr } = await jq;
  if (jobsErr) return NextResponse.json({ error: jobsErr.message }, { status: 500 });

  const jobRows = jobs || [];
  const jobIds = jobRows.map((j: any) => j.id);
  if (jobIds.length === 0) return NextResponse.json({ entries: [], weights: WEIGHTS, job_count: 0 });

  const invoiceOf = new Map<string, number>();
  const componentsOf = new Map<string, number>();
  for (const j of jobRows as any[]) {
    const inv = j.st_revenue != null ? Number(j.st_revenue) : (j.job_total != null && Number(j.job_total) > 0 ? Number(j.job_total) : 0);
    invoiceOf.set(j.id, inv);
    componentsOf.set(j.id, j.component_count != null ? Number(j.component_count) : 0);
  }

  // 2) Crew (hours) across those jobs.
  const { data: crewData } = await supabase
    .from('ap_job_st_labor')
    .select('job_id, st_technician_id, technician_id, technician_name, hours')
    .in('job_id', jobIds)
    .not('st_technician_id', 'is', null);
  const crew = (crewData || []) as any[];

  // Who is an "HVAC Install - Lead" (ST role synced onto ap_technicians)?
  const { data: leadTechs } = await supabase
    .from('ap_technicians')
    .select('st_technician_id, name, business_unit_name')
    .eq('is_install_lead', true);
  const leadSet = new Set<number>((leadTechs || []).map((t: any) => Number(t.st_technician_id)));
  const techMap = new Map((leadTechs || []).map((t: any) => [Number(t.st_technician_id), t]));
  if (leadSet.size === 0) return NextResponse.json({ entries: [], weights: WEIGHTS, job_count: 0 });

  // 3) Per job: total crew hours + the lead. The lead is the crew member flagged
  //    "HVAC Install - Lead" (max hours among them if more than one). Jobs with no lead
  //    on the crew are not credited to anyone on this board.
  const jobCrew = new Map<string, any[]>();
  for (const c of crew) {
    if (!jobCrew.has(c.job_id)) jobCrew.set(c.job_id, []);
    jobCrew.get(c.job_id)!.push(c);
  }

  // 4) Aggregate per lead installer (keyed by st_technician_id).
  //    compHours tracks hours only on jobs that have a component count, so
  //    hours-per-component stays a fair ratio (same job set on top and bottom).
  const agg = new Map<number, { name: string; jobs: number; revenue: number; hours: number; components: number; compHours: number }>();
  for (const [jobId, members] of jobCrew) {
    const leadsOnCrew = members.filter(m => leadSet.has(Number(m.st_technician_id)));
    if (leadsOnCrew.length === 0) continue; // no HVAC Install - Lead on this job
    const lead = leadsOnCrew.reduce((a, b) => (Number(b.hours || 0) > Number(a.hours || 0) ? b : a));
    const stId = Number(lead.st_technician_id);
    const totalHours = members.reduce((s, m) => s + Number(m.hours || 0), 0);
    const comps = componentsOf.get(jobId) || 0;
    const cur = agg.get(stId) || { name: lead.technician_name || '', jobs: 0, revenue: 0, hours: 0, components: 0, compHours: 0 };
    cur.jobs += 1;
    cur.revenue += invoiceOf.get(jobId) || 0;
    cur.hours += totalHours;
    cur.components += comps;
    if (comps > 0) cur.compHours += totalHours;
    if (!cur.name && lead.technician_name) cur.name = lead.technician_name;
    agg.set(stId, cur);
  }
  if (agg.size === 0) return NextResponse.json({ entries: [], weights: WEIGHTS, job_count: 0 });

  const leadStIds = Array.from(agg.keys());
  const creditedJobs = Array.from(agg.values()).reduce((s, v) => s + v.jobs, 0);

  // 5) Recalls caused (lower is better), in range.
  const recallCount = new Map<number, number>();
  {
    let rq = supabase.from('sd_recalls_caused').select('caused_by_tech_id').in('caused_by_tech_id', leadStIds);
    if (start) rq = rq.gte('recall_created_on', start);
    if (end) rq = rq.lte('recall_created_on', end);
    const { data: recalls } = await rq;
    for (const r of (recalls || []) as any[]) {
      const id = Number(r.caused_by_tech_id);
      recallCount.set(id, (recallCount.get(id) || 0) + 1);
    }
  }

  // 6) Review mentions, in range (matched by name).
  const reviewCount = new Map<number, number>();
  {
    let vq = supabase.from('google_reviews').select('team_members_mentioned, update_time').not('team_members_mentioned', 'is', null);
    if (start) vq = vq.gte('update_time', start);
    if (end) vq = vq.lte('update_time', `${end}T23:59:59`);
    const { data: reviews } = await vq;
    const nameToId = new Map<string, number>();
    for (const id of leadStIds) {
      const nm = (techMap.get(id)?.name || agg.get(id)?.name || '').trim().toLowerCase();
      if (nm) nameToId.set(nm, id);
    }
    for (const rv of (reviews || []) as any[]) {
      const mentioned: string[] = Array.isArray(rv.team_members_mentioned) ? rv.team_members_mentioned : [];
      for (const m of mentioned) {
        const id = nameToId.get(String(m).trim().toLowerCase());
        if (id != null) reviewCount.set(id, (reviewCount.get(id) || 0) + 1);
      }
    }
  }

  // 7) Build entries + weighted-percentile score.
  const base = leadStIds.map((id) => {
    const v = agg.get(id)!;
    const t = techMap.get(id);
    return {
      st_technician_id: id,
      name: t?.name || v.name || '—',
      home_team: t?.business_unit_name || null,
      jobs_led: v.jobs,
      revenue: Math.round(v.revenue * 100) / 100,
      hours: Math.round(v.hours * 100) / 100,
      rev_per_hour: v.hours > 0 ? Math.round((v.revenue / v.hours) * 100) / 100 : 0,
      components: v.components,
      hours_per_component: v.components > 0 ? Math.round((v.compHours / v.components) * 100) / 100 : 0,
      recalls: recallCount.get(id) || 0,
      reviews: reviewCount.get(id) || 0,
    };
  });

  const N = base.length;
  // Percentile from rank: 1st of N -> 1.0, Nth -> 1/N. desc=true means higher value ranks better.
  const pctByMetric = (values: number[], higherBetter: boolean): number[] => {
    const order = values.map((val, i) => ({ val, i }))
      .sort((a, b) => higherBetter ? b.val - a.val : a.val - b.val);
    const rankOf = new Array(N).fill(0);
    order.forEach((o, idx) => { rankOf[o.i] = idx + 1; });
    return rankOf.map(r => (N - r + 1) / N);
  };
  const revPct = pctByMetric(base.map(b => b.revenue), true);
  const effPct = pctByMetric(base.map(b => b.rev_per_hour), true);
  const recPct = pctByMetric(base.map(b => b.recalls), false); // fewer recalls = better
  const rvwPct = pctByMetric(base.map(b => b.reviews), true);

  const entries: Entry[] = base.map((b, i) => {
    const breakdown = { revenue: revPct[i], efficiency: effPct[i], recalls: recPct[i], reviews: rvwPct[i] };
    const score = breakdown.revenue * WEIGHTS.revenue + breakdown.efficiency * WEIGHTS.efficiency
      + breakdown.recalls * WEIGHTS.recalls + breakdown.reviews * WEIGHTS.reviews;
    return { ...b, score, rank: 0, breakdown };
  });
  entries.sort((a, b) => b.score - a.score);
  entries.forEach((e, i) => { e.rank = i + 1; });

  return NextResponse.json({ entries, weights: WEIGHTS, job_count: creditedJobs });
}
