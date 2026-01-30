import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

interface RouteContext {
  params: Promise<{ code: string }>;
}

/**
 * Public API endpoint for fetching tracker by tracking code.
 * No authentication required - this is for customer-facing tracker pages.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { code } = await context.params;
  const supabase = getServerSupabase();

  // Fetch the tracker with limited fields (public view)
  const { data: tracker, error } = await supabase
    .from('job_trackers')
    .select(`
      id,
      tracking_code,
      customer_name,
      job_address,
      trade,
      job_type,
      job_description,
      status,
      progress_percent,
      scheduled_date,
      estimated_completion,
      actual_completion,
      notify_sms,
      notify_email,
      notification_phone,
      notification_email
    `)
    .eq('tracking_code', code)
    .single();

  if (error || !tracker) {
    return NextResponse.json({ error: 'Tracker not found' }, { status: 404 });
  }

  // Fetch milestones (limited fields for public view)
  const { data: milestones } = await supabase
    .from('tracker_milestones')
    .select(`
      id,
      name,
      description,
      icon,
      sort_order,
      status,
      completed_at,
      customer_notes
    `)
    .eq('tracker_id', tracker.id)
    .order('sort_order', { ascending: true });

  return NextResponse.json({
    ...tracker,
    milestones: milestones || [],
  });
}
