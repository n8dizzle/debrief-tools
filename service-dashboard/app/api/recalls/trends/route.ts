import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { computeRecallRate, timeToRecallBucket, hasRecallPermission } from '@/lib/qc-recalls';

// GET /api/recalls/trends?startDate=&endDate=&trade=hvac|plumbing|all
// Aggregates for the Recall Trends dashboard: tech recall-rate, equipment counts,
// time-to-recall buckets, root-cause rollup, + equipment coverage.
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasRecallPermission(session, 'view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const trade = searchParams.get('trade') || 'all';
  if (!startDate || !endDate) return NextResponse.json({ error: 'startDate and endDate required' }, { status: 400 });

  const supabase = getServerSupabase();

  // Recalls in period (ALL business units — QC scope, not the leaderboard slice)
  let recallQuery = supabase
    .from('sd_recalls_caused')
    .select('st_recall_job_id, caused_by_tech_id, days_to_recall, equipment_id, trade, business_unit_name')
    .gte('recall_created_on', startDate)
    .lte('recall_created_on', endDate);
  if (trade === 'hvac' || trade === 'plumbing') recallQuery = recallQuery.eq('trade', trade);
  const { data: recalls } = await recallQuery;
  const recallRows = recalls || [];

  // Technician names
  const { data: techs } = await supabase.from('sd_technicians').select('st_technician_id, name, trade');
  const techName = new Map<number, string>((techs || []).map(t => [t.st_technician_id, t.name]));

  // Denominator: completed jobs per tech in period (sd_completed_jobs — service techs).
  const { data: completed } = await supabase
    .from('sd_completed_jobs')
    .select('st_technician_id')
    .gte('completed_date', startDate)
    .lte('completed_date', endDate);
  const completedByTech = new Map<number, number>();
  for (const j of (completed || [])) completedByTech.set(j.st_technician_id, (completedByTech.get(j.st_technician_id) || 0) + 1);

  // 1) Tech recall-rate leaderboard
  const recallByTech = new Map<number, number>();
  for (const r of recallRows) if (r.caused_by_tech_id != null) recallByTech.set(r.caused_by_tech_id, (recallByTech.get(r.caused_by_tech_id) || 0) + 1);
  const techRates = Array.from(recallByTech.entries()).map(([techId, recallCount]) => {
    const completedJobs = completedByTech.get(techId) || 0;
    return {
      st_technician_id: techId,
      name: techName.get(techId) || `Tech ${techId}`,
      recalls: recallCount,
      completed_jobs: completedJobs,
      rate: computeRecallRate(recallCount, completedJobs), // null when below threshold / no denominator
    };
  }).sort((a, b) => {
    if (a.rate === null && b.rate === null) return b.recalls - a.recalls;
    if (a.rate === null) return 1;
    if (b.rate === null) return -1;
    return b.rate - a.rate;
  });

  // 2) Equipment counts (only recalls with an equipment link)
  const equipIds = Array.from(new Set(recallRows.map(r => r.equipment_id).filter((e): e is number => e != null)));
  const equipInfo = new Map<number, { manufacturer: string | null; model: string | null }>();
  if (equipIds.length > 0) {
    const { data: eq } = await supabase.from('sd_equipment').select('st_equipment_id, manufacturer, model').in('st_equipment_id', equipIds);
    for (const e of (eq || [])) equipInfo.set(e.st_equipment_id, { manufacturer: e.manufacturer, model: e.model });
  }
  const equipCount = new Map<string, number>();
  let recallsWithEquip = 0;
  for (const r of recallRows) {
    if (r.equipment_id == null) continue;
    recallsWithEquip++;
    const info = equipInfo.get(r.equipment_id);
    const label = info ? [info.manufacturer, info.model].filter(Boolean).join(' ') || 'Unknown' : 'Unknown';
    equipCount.set(label, (equipCount.get(label) || 0) + 1);
  }
  const equipment = Array.from(equipCount.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

  // 3) Time-to-recall buckets
  const buckets: Record<string, number> = { '≤7d': 0, '8–30d': 0, '31–90d': 0, '90d+': 0, 'unknown': 0 };
  for (const r of recallRows) buckets[timeToRecallBucket(r.days_to_recall)]++;

  // 4) Root-cause rollup (resolved investigations for the recalls in this period)
  const recallJobIds = recallRows.map(r => r.st_recall_job_id);
  const rootCause = new Map<string, number>();
  if (recallJobIds.length > 0) {
    const { data: invs } = await supabase
      .from('sd_recall_investigations')
      .select('root_cause_category')
      .in('st_recall_job_id', recallJobIds)
      .not('root_cause_category', 'is', null);
    for (const i of (invs || [])) rootCause.set(i.root_cause_category, (rootCause.get(i.root_cause_category) || 0) + 1);
  }
  const rootCauses = Array.from(rootCause.entries()).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);

  return NextResponse.json({
    total_recalls: recallRows.length,
    tech_rates: techRates,
    equipment,
    equipment_coverage: { with_equipment: recallsWithEquip, total: recallRows.length },
    time_to_recall: buckets,
    root_causes: rootCauses,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
