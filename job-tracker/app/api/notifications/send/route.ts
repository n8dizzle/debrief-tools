import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { notifyMilestoneComplete, notifyTrackerCreated, notifyTrackerComplete } from '@/lib/notifications';

/**
 * API endpoint to manually trigger notifications.
 * Staff-only - used after milestone updates or for manual resends.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const body = await request.json();

  const { tracker_id, milestone_id, type } = body;

  if (!tracker_id || !type) {
    return NextResponse.json({ error: 'tracker_id and type are required' }, { status: 400 });
  }

  // Fetch the tracker
  const { data: tracker, error: trackerError } = await supabase
    .from('job_trackers')
    .select('*')
    .eq('id', tracker_id)
    .single();

  if (trackerError || !tracker) {
    return NextResponse.json({ error: 'Tracker not found' }, { status: 404 });
  }

  let results: { sms: boolean; email: boolean } = { sms: false, email: false };

  switch (type) {
    case 'milestone': {
      if (!milestone_id) {
        return NextResponse.json({ error: 'milestone_id is required for milestone notifications' }, { status: 400 });
      }

      const { data: milestone, error: milestoneError } = await supabase
        .from('tracker_milestones')
        .select('*')
        .eq('id', milestone_id)
        .eq('tracker_id', tracker_id)
        .single();

      if (milestoneError || !milestone) {
        return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
      }

      results = await notifyMilestoneComplete(tracker, milestone);
      break;
    }

    case 'welcome':
      results = await notifyTrackerCreated(tracker);
      break;

    case 'completion':
      results = await notifyTrackerComplete(tracker);
      break;

    default:
      return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
  }

  return NextResponse.json({
    success: results.sms || results.email,
    results,
  });
}
