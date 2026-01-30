import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { generateTrackingCode } from '@/lib/tracking-code';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const searchParams = request.nextUrl.searchParams;

  let query = supabase
    .from('job_trackers')
    .select('*')
    .order('created_at', { ascending: false });

  const status = searchParams.get('status');
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const trade = searchParams.get('trade');
  if (trade && trade !== 'all') {
    query = query.eq('trade', trade);
  }

  const search = searchParams.get('search');
  if (search) {
    query = query.or(
      `customer_name.ilike.%${search}%,job_number.ilike.%${search}%,tracking_code.ilike.%${search}%`
    );
  }

  const limit = searchParams.get('limit');
  if (limit) {
    query = query.limit(parseInt(limit));
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const body = await request.json();

  // Generate unique tracking code
  let trackingCode = generateTrackingCode();
  let attempts = 0;
  const maxAttempts = 5;

  // Ensure tracking code is unique
  while (attempts < maxAttempts) {
    const { data: existing } = await supabase
      .from('job_trackers')
      .select('id')
      .eq('tracking_code', trackingCode)
      .single();

    if (!existing) break;
    trackingCode = generateTrackingCode();
    attempts++;
  }

  if (attempts === maxAttempts) {
    return NextResponse.json({ error: 'Failed to generate unique tracking code' }, { status: 500 });
  }

  // Create the tracker
  const { data: tracker, error: trackerError } = await supabase
    .from('job_trackers')
    .insert({
      tracking_code: trackingCode,
      customer_name: body.customer_name,
      customer_email: body.customer_email || null,
      customer_phone: body.customer_phone || null,
      job_address: body.job_address || null,
      job_number: body.job_number || null,
      st_job_id: body.st_job_id || null,
      trade: body.trade,
      job_type: body.job_type,
      job_description: body.job_description || null,
      template_id: body.template_id || null,
      scheduled_date: body.scheduled_date || null,
      estimated_completion: body.estimated_completion || null,
      notify_sms: body.notify_sms || false,
      notify_email: body.notify_email !== false,
      notification_phone: body.notification_phone || null,
      notification_email: body.notification_email || null,
      created_by: body.created_by || session.user.id,
      auto_created: body.auto_created || false,
    })
    .select()
    .single();

  if (trackerError) {
    console.error('Failed to create tracker:', trackerError);
    return NextResponse.json({ error: trackerError.message }, { status: 500 });
  }

  // If a template is selected, copy its milestones
  if (body.template_id) {
    const { data: templateMilestones } = await supabase
      .from('tracker_template_milestones')
      .select('*')
      .eq('template_id', body.template_id)
      .order('sort_order', { ascending: true });

    if (templateMilestones && templateMilestones.length > 0) {
      const milestonesToInsert = templateMilestones.map((tm) => ({
        tracker_id: tracker.id,
        template_milestone_id: tm.id,
        name: tm.name,
        description: tm.description,
        icon: tm.icon,
        sort_order: tm.sort_order,
        is_optional: tm.is_optional,
        status: 'pending',
      }));

      const { error: milestonesError } = await supabase
        .from('tracker_milestones')
        .insert(milestonesToInsert);

      if (milestonesError) {
        console.error('Failed to create milestones:', milestonesError);
      }

      // Set the first milestone as current
      const { data: firstMilestone } = await supabase
        .from('tracker_milestones')
        .select('id')
        .eq('tracker_id', tracker.id)
        .order('sort_order', { ascending: true })
        .limit(1)
        .single();

      if (firstMilestone) {
        await supabase
          .from('job_trackers')
          .update({ current_milestone_id: firstMilestone.id })
          .eq('id', tracker.id);
      }
    }
  }

  // Log activity
  await supabase.from('tracker_activity').insert({
    tracker_id: tracker.id,
    activity_type: 'tracker_created',
    description: `Tracker created for ${body.customer_name}`,
    performed_by: session.user.id,
  });

  return NextResponse.json(tracker, { status: 201 });
}
