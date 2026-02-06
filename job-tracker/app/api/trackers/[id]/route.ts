import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = getServerSupabase();

  const { data: tracker, error } = await supabase
    .from('job_trackers')
    .select(`
      *,
      milestones:tracker_milestones(*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(tracker);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = getServerSupabase();
  const body = await request.json();

  // Get current tracker for comparison
  const { data: currentTracker } = await supabase
    .from('job_trackers')
    .select('*')
    .eq('id', id)
    .single();

  if (!currentTracker) {
    return NextResponse.json({ error: 'Tracker not found' }, { status: 404 });
  }

  // Build update object
  const updates: Record<string, unknown> = {};
  const allowedFields = [
    'customer_name',
    'customer_email',
    'customer_phone',
    'job_address',
    'job_number',
    'job_description',
    'status',
    'scheduled_date',
    'estimated_completion',
    'actual_completion',
    'notify_sms',
    'notify_email',
    'notification_phone',
    'notification_email',
    'assigned_to',
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  // If status is changing to completed, set actual_completion
  if (body.status === 'completed' && currentTracker.status !== 'completed') {
    updates.actual_completion = new Date().toISOString().split('T')[0];
    updates.progress_percent = 100;
  }

  const { data: tracker, error } = await supabase
    .from('job_trackers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log status change
  if (body.status && body.status !== currentTracker.status) {
    await supabase.from('tracker_activity').insert({
      tracker_id: id,
      activity_type: 'status_changed',
      description: `Status changed from ${currentTracker.status} to ${body.status}`,
      old_value: currentTracker.status,
      new_value: body.status,
      performed_by: session.user.id,
    });
  }

  return NextResponse.json(tracker);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = getServerSupabase();

  const { error } = await supabase.from('job_trackers').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
