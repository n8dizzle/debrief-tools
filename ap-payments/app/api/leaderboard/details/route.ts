import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

/**
 * GET /api/leaderboard/details?techId&metric&start&end — the records behind one
 * installer's leaderboard metric, for the drill-down modal.
 *   revenue / efficiency → the install jobs this lead led (job #, completed, customer,
 *                          invoice, crew hours)
 *   recalls              → recalls caused by this lead (sd_recalls_caused)
 *   reviews              → Google reviews mentioning this lead by name
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_view_jobs')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const techId = parseInt(searchParams.get('techId') || '', 10);
  const metric = searchParams.get('metric');
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  if (!techId || !metric) return NextResponse.json({ error: 'techId and metric required' }, { status: 400 });

  const supabase = getServerSupabase();

  if (metric === 'recalls') {
    let q = supabase.from('sd_recalls_caused')
      .select('st_recall_job_id, st_original_job_id, recall_created_on, business_unit_name, customer_name, days_to_recall')
      .eq('caused_by_tech_id', techId)
      .order('recall_created_on', { ascending: false });
    if (start) q = q.gte('recall_created_on', start);
    if (end) q = q.lte('recall_created_on', end);
    const { data } = await q;
    return NextResponse.json({ records: data || [] });
  }

  if (metric === 'reviews') {
    const { data: tech } = await supabase.from('ap_technicians').select('name').eq('st_technician_id', techId).maybeSingle();
    const name = (tech?.name || '').trim().toLowerCase();
    if (!name) return NextResponse.json({ records: [] });
    let q = supabase.from('google_reviews')
      .select('reviewer_name, star_rating, comment, create_time, update_time, team_members_mentioned')
      .not('team_members_mentioned', 'is', null)
      .order('update_time', { ascending: false });
    if (start) q = q.gte('update_time', start);
    if (end) q = q.lte('update_time', `${end}T23:59:59`);
    const { data } = await q;
    const records = (data || []).filter((r: any) => {
      const m: string[] = Array.isArray(r.team_members_mentioned) ? r.team_members_mentioned : [];
      return m.some(x => String(x).trim().toLowerCase() === name);
    }).map((r: any) => ({
      reviewer_name: r.reviewer_name, star_rating: r.star_rating, comment: r.comment,
      create_time: r.create_time || r.update_time,
    }));
    return NextResponse.json({ records });
  }

  // revenue / efficiency → the jobs this lead led (same attribution as the board).
  if (metric === 'revenue' || metric === 'efficiency') {
    let jq = supabase.from('ap_install_jobs')
      .select('id, st_job_id, job_number, customer_name, completed_date, st_revenue, job_total')
      .eq('business_unit_name', 'HVAC - Install')
      .neq('job_status', 'Canceled')
      .or('is_ignored.is.null,is_ignored.eq.false');
    if (start) jq = jq.gte('completed_date', start);
    if (end) jq = jq.lte('completed_date', end);
    const { data: jobs } = await jq;
    const jobRows = jobs || [];
    if (jobRows.length === 0) return NextResponse.json({ records: [] });
    const jobIds = jobRows.map((j: any) => j.id);
    const jobMeta = new Map(jobRows.map((j: any) => [j.id, j]));

    const { data: leadTechs } = await supabase.from('ap_technicians').select('st_technician_id').eq('is_install_lead', true);
    const leadSet = new Set<number>((leadTechs || []).map((t: any) => Number(t.st_technician_id)));

    const { data: crewData } = await supabase.from('ap_job_st_labor')
      .select('job_id, st_technician_id, hours').in('job_id', jobIds).not('st_technician_id', 'is', null);
    const jobCrew = new Map<string, any[]>();
    for (const c of (crewData || []) as any[]) {
      if (!jobCrew.has(c.job_id)) jobCrew.set(c.job_id, []);
      jobCrew.get(c.job_id)!.push(c);
    }

    const records: any[] = [];
    for (const [jobId, members] of jobCrew) {
      const leadsOnCrew = members.filter(m => leadSet.has(Number(m.st_technician_id)));
      if (leadsOnCrew.length === 0) continue;
      const lead = leadsOnCrew.reduce((a, b) => (Number(b.hours || 0) > Number(a.hours || 0) ? b : a));
      if (Number(lead.st_technician_id) !== techId) continue;
      const j: any = jobMeta.get(jobId);
      const invoice = j.st_revenue != null ? Number(j.st_revenue) : (j.job_total != null && Number(j.job_total) > 0 ? Number(j.job_total) : 0);
      const hours = members.reduce((s, m) => s + Number(m.hours || 0), 0);
      records.push({
        st_job_id: j.st_job_id, job_number: j.job_number, customer_name: j.customer_name,
        completed_date: j.completed_date, invoice: Math.round(invoice * 100) / 100,
        hours: Math.round(hours * 100) / 100,
        rev_per_hour: hours > 0 ? Math.round((invoice / hours) * 100) / 100 : 0,
      });
    }
    records.sort((a, b) => (b.completed_date || '').localeCompare(a.completed_date || ''));
    return NextResponse.json({ records });
  }

  return NextResponse.json({ error: 'Invalid metric' }, { status: 400 });
}
