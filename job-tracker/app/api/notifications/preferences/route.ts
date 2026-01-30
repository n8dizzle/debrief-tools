import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

/**
 * Public API endpoint for updating notification preferences.
 * No authentication required - customers update their own preferences via tracking code.
 */
export async function POST(request: NextRequest) {
  const supabase = getServerSupabase();
  const body = await request.json();

  const { tracking_code, notify_sms, notify_email, notification_phone, notification_email } = body;

  if (!tracking_code) {
    return NextResponse.json({ error: 'tracking_code is required' }, { status: 400 });
  }

  // Verify tracker exists
  const { data: tracker, error: findError } = await supabase
    .from('job_trackers')
    .select('id')
    .eq('tracking_code', tracking_code)
    .single();

  if (findError || !tracker) {
    return NextResponse.json({ error: 'Tracker not found' }, { status: 404 });
  }

  // Update notification preferences
  const updates: Record<string, unknown> = {};

  if (typeof notify_sms === 'boolean') {
    updates.notify_sms = notify_sms;
  }

  if (typeof notify_email === 'boolean') {
    updates.notify_email = notify_email;
  }

  if (notification_phone !== undefined) {
    updates.notification_phone = notification_phone || null;
  }

  if (notification_email !== undefined) {
    updates.notification_email = notification_email || null;
  }

  const { error: updateError } = await supabase
    .from('job_trackers')
    .update(updates)
    .eq('id', tracker.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log the preference update
  await supabase.from('tracker_activity').insert({
    tracker_id: tracker.id,
    activity_type: 'preferences_updated',
    description: 'Customer updated notification preferences',
    performed_by_system: true,
    metadata: { updates },
  });

  return NextResponse.json({ success: true });
}
