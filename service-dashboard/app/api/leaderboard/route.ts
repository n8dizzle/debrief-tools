import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { computeLeaderboardScores, DEFAULT_WEIGHTS } from '@/lib/sd-utils';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // 1. Get scoring weights
  const { data: configRow } = await supabase
    .from('sd_scoring_config')
    .select('weights')
    .limit(1)
    .single();

  const weights = configRow?.weights || DEFAULT_WEIGHTS;

  // 2. Get active technicians
  const { data: technicians } = await supabase
    .from('sd_technicians')
    .select('*')
    .eq('is_active', true);

  if (!technicians || technicians.length === 0) {
    return NextResponse.json({
      leaderboard: [],
      totals: { gross_sales: 0, tgls: 0, options_per_opportunity: 0, reviews: 0, memberships_sold: 0 },
      weights,
    });
  }

  // Build lookup maps
  const techById = new Map(technicians.map(t => [t.st_technician_id, t]));
  const techIds = technicians.map(t => t.st_technician_id);

  // 3. Sum sales from sold estimates
  const { data: soldEstimates } = await supabase
    .from('sd_estimates')
    .select('sold_by_id, subtotal')
    .in('sold_by_id', techIds)
    .gte('sold_on', startDate)
    .lte('sold_on', endDate);

  const salesByTech = new Map<number, number>();
  for (const est of (soldEstimates || [])) {
    salesByTech.set(
      est.sold_by_id,
      (salesByTech.get(est.sold_by_id) || 0) + (est.subtotal || 0)
    );
  }

  // 4. Count TGLs (leads set — unique source jobs by completion date)
  const { data: leads } = await supabase
    .from('sd_tgl_leads')
    .select('created_by_id')
    .in('created_by_id', techIds)
    .gte('created_on', startDate)
    .lte('created_on', endDate);

  const tglsByTech = new Map<number, number>();
  for (const lead of (leads || [])) {
    tglsByTech.set(lead.created_by_id, (tglsByTech.get(lead.created_by_id) || 0) + 1);
  }

  // 4b. Compute Options per Opportunity from completed jobs
  // Per tech: sum(estimate_count) / count(jobs)
  const { data: completedJobs } = await supabase
    .from('sd_completed_jobs')
    .select('st_technician_id, estimate_count')
    .in('st_technician_id', techIds)
    .gte('completed_date', startDate)
    .lte('completed_date', endDate);

  const estCountByTech = new Map<number, number>();
  const jobCountByTech = new Map<number, number>();
  for (const job of (completedJobs || [])) {
    estCountByTech.set(
      job.st_technician_id,
      (estCountByTech.get(job.st_technician_id) || 0) + (job.estimate_count || 0)
    );
    jobCountByTech.set(
      job.st_technician_id,
      (jobCountByTech.get(job.st_technician_id) || 0) + 1
    );
  }

  const optsByTech = new Map<number, number>();
  for (const techId of techIds) {
    const totalEstimates = estCountByTech.get(techId) || 0;
    const totalJobs = jobCountByTech.get(techId) || 0;
    optsByTech.set(techId, totalJobs > 0 ? totalEstimates / totalJobs : 0);
  }

  // 5. Count reviews via team_members linkage
  const techsWithTeamMember = technicians.filter(t => t.team_member_id);
  const teamMemberIds = techsWithTeamMember.map(t => t.team_member_id);

  const { data: teamMembers } = await supabase
    .from('team_members')
    .select('id, name')
    .in('id', teamMemberIds.length > 0 ? teamMemberIds : ['__none__']);

  const tmNameToTechId = new Map<string, number>();
  if (teamMembers) {
    for (const tm of teamMembers) {
      const tech = techsWithTeamMember.find(t => t.team_member_id === tm.id);
      if (tech) {
        tmNameToTechId.set(tm.name, tech.st_technician_id);
      }
    }
  }

  const reviewsByTech = new Map<number, number>();
  if (tmNameToTechId.size > 0) {
    const { data: reviews } = await supabase
      .from('google_reviews')
      .select('team_members_mentioned, confirmed_mentions')
      .or('team_members_mentioned.not.is.null,confirmed_mentions.not.is.null')
      .gte('create_time', `${startDate}T00:00:00`)
      .lte('create_time', `${endDate}T23:59:59`)
      .limit(10000);

    for (const review of (reviews || [])) {
      const mentions = (review.confirmed_mentions as string[] | null) ?? (review.team_members_mentioned as string[] | null);
      if (!mentions) continue;

      for (const name of mentions) {
        const techId = tmNameToTechId.get(name);
        if (techId) {
          reviewsByTech.set(techId, (reviewsByTech.get(techId) || 0) + 1);
        }
      }
    }
  }

  // 6. Count memberships sold
  const { data: memberships } = await supabase
    .from('sd_memberships_sold')
    .select('sold_by_id')
    .in('sold_by_id', techIds)
    .gte('sold_on', startDate)
    .lte('sold_on', endDate);

  const membershipsByTech = new Map<number, number>();
  for (const mem of (memberships || [])) {
    membershipsByTech.set(mem.sold_by_id, (membershipsByTech.get(mem.sold_by_id) || 0) + 1);
  }

  // 7. Sum attendance points per tech within the date range
  const techDbIds = technicians.map(t => t.id);
  const { data: attendanceRecords } = await supabase
    .from('sd_attendance_records')
    .select('technician_id, points')
    .in('technician_id', techDbIds)
    .gte('date', startDate)
    .lte('date', endDate);

  const attendanceByTech = new Map<string, number>();
  for (const rec of (attendanceRecords || [])) {
    attendanceByTech.set(
      rec.technician_id,
      (attendanceByTech.get(rec.technician_id) || 0) + (rec.points || 0)
    );
  }

  // 8. Assemble tech data and compute scores
  const techData = technicians.map(tech => ({
    technician_id: tech.id,
    st_technician_id: tech.st_technician_id,
    name: tech.name,
    trade: tech.trade as 'hvac' | 'plumbing',
    gross_sales: salesByTech.get(tech.st_technician_id) || 0,
    tgls: tglsByTech.get(tech.st_technician_id) || 0,
    options_per_opportunity: Math.round((optsByTech.get(tech.st_technician_id) || 0) * 100) / 100,
    reviews: reviewsByTech.get(tech.st_technician_id) || 0,
    memberships_sold: membershipsByTech.get(tech.st_technician_id) || 0,
    attendance_points: Math.round((attendanceByTech.get(tech.id) || 0) * 10) / 10,
  }));

  const leaderboard = computeLeaderboardScores(techData, weights);

  // Last successful sync
  const { data: lastSync } = await supabase
    .from('sd_sync_log')
    .select('completed_at')
    .eq('status', 'success')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  // Totals
  const totalEstimates = techData.reduce((sum, t) => sum + (estCountByTech.get(t.st_technician_id) || 0), 0);
  const totalJobCount = techData.reduce((sum, t) => sum + (jobCountByTech.get(t.st_technician_id) || 0), 0);
  const totals = {
    gross_sales: techData.reduce((sum, t) => sum + t.gross_sales, 0),
    tgls: techData.reduce((sum, t) => sum + t.tgls, 0),
    options_per_opportunity: totalJobCount > 0 ? Math.round((totalEstimates / totalJobCount) * 100) / 100 : 0,
    reviews: techData.reduce((sum, t) => sum + t.reviews, 0),
    memberships_sold: techData.reduce((sum, t) => sum + t.memberships_sold, 0),
    attendance_points: techData.reduce((sum, t) => sum + t.attendance_points, 0),
  };

  return NextResponse.json({
    leaderboard,
    totals,
    weights,
    lastSyncAt: lastSync?.completed_at || null,
  }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}
