import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const techId = searchParams.get('techId');
  const metric = searchParams.get('metric');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!techId || !metric || !startDate || !endDate) {
    return NextResponse.json({ error: 'techId, metric, startDate, endDate required' }, { status: 400 });
  }

  const stTechId = parseInt(techId, 10);
  const supabase = getServerSupabase();

  if (metric === 'gross_sales') {
    // Group sold estimates by job (closed opportunities)
    const { data } = await supabase
      .from('sd_estimates')
      .select('st_estimate_id, st_job_id, subtotal, sold_on, status')
      .eq('sold_by_id', stTechId)
      .gte('sold_on', startDate)
      .lte('sold_on', endDate)
      .order('sold_on', { ascending: false });

    // Group by job: one row per job with combined subtotal
    const byJob = new Map<number, { st_job_id: number; subtotal: number; sold_on: string; estimate_ids: number[] }>();
    for (const est of (data || [])) {
      const jobId = est.st_job_id || est.st_estimate_id; // fallback if no job
      const existing = byJob.get(jobId);
      if (existing) {
        existing.subtotal += est.subtotal || 0;
        existing.estimate_ids.push(est.st_estimate_id);
        // Use earliest sold_on date
        if (est.sold_on < existing.sold_on) existing.sold_on = est.sold_on;
      } else {
        byJob.set(jobId, {
          st_job_id: jobId,
          subtotal: est.subtotal || 0,
          sold_on: est.sold_on,
          estimate_ids: [est.st_estimate_id],
        });
      }
    }

    const records = Array.from(byJob.values()).sort((a, b) => b.sold_on.localeCompare(a.sold_on));
    return NextResponse.json({ records });
  }

  if (metric === 'tgls') {
    const { data } = await supabase
      .from('sd_tgl_leads')
      .select('st_lead_id, created_on, customer_name, status, source_job_id')
      .eq('created_by_id', stTechId)
      .gte('created_on', startDate)
      .lte('created_on', endDate)
      .order('created_on', { ascending: false });

    return NextResponse.json({ records: data || [] });
  }

  if (metric === 'memberships_sold') {
    const { data } = await supabase
      .from('sd_memberships_sold')
      .select('st_membership_id, membership_type_name, sold_on')
      .eq('sold_by_id', stTechId)
      .gte('sold_on', startDate)
      .lte('sold_on', endDate)
      .order('sold_on', { ascending: false });

    return NextResponse.json({ records: data || [] });
  }

  if (metric === 'options_per_opportunity') {
    const { data } = await supabase
      .from('sd_completed_jobs')
      .select('st_job_id, estimate_count, completed_date, customer_name')
      .eq('st_technician_id', stTechId)
      .gte('completed_date', startDate)
      .lte('completed_date', endDate)
      .order('completed_date', { ascending: false });

    return NextResponse.json({ records: data || [] });
  }

  if (metric === 'reviews') {
    // Get team_member_id for this tech
    const { data: tech } = await supabase
      .from('sd_technicians')
      .select('team_member_id')
      .eq('st_technician_id', stTechId)
      .single();

    if (!tech?.team_member_id) {
      return NextResponse.json({ records: [] });
    }

    // Get team member name
    const { data: tm } = await supabase
      .from('team_members')
      .select('name')
      .eq('id', tech.team_member_id)
      .single();

    if (!tm?.name) {
      return NextResponse.json({ records: [] });
    }

    // Get reviews mentioning this team member
    const { data: reviews } = await supabase
      .from('google_reviews')
      .select('id, reviewer_name, star_rating, comment, create_time, team_members_mentioned, confirmed_mentions')
      .or('team_members_mentioned.not.is.null,confirmed_mentions.not.is.null')
      .gte('create_time', `${startDate}T00:00:00`)
      .lte('create_time', `${endDate}T23:59:59`)
      .order('create_time', { ascending: false })
      .limit(10000);

    // Filter to reviews mentioning this tech
    const matching = (reviews || []).filter(r => {
      const mentions = (r.confirmed_mentions as string[] | null) ?? (r.team_members_mentioned as string[] | null);
      return mentions?.includes(tm.name);
    }).map(r => ({
      reviewer_name: r.reviewer_name,
      star_rating: r.star_rating,
      comment: r.comment,
      create_time: r.create_time,
    }));

    return NextResponse.json({ records: matching });
  }

  if (metric === 'attendance') {
    // Look up the tech's internal id from st_technician_id
    const { data: tech } = await supabase
      .from('sd_technicians')
      .select('id')
      .eq('st_technician_id', stTechId)
      .single();

    if (!tech?.id) {
      return NextResponse.json({ records: [] });
    }

    const { data } = await supabase
      .from('sd_attendance_records')
      .select('date, type, points, notes')
      .eq('technician_id', tech.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    return NextResponse.json({ records: data || [] });
  }

  return NextResponse.json({ error: 'Invalid metric' }, { status: 400 });
}
