import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase, MilestoneStatus } from '@/lib/supabase';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: trackerId } = await context.params;
  const supabase = getServerSupabase();
  const body = await request.json();

  const { milestone_id, status, customer_notes, staff_notes } = body;

  if (!milestone_id || !status) {
    return NextResponse.json({ error: 'milestone_id and status are required' }, { status: 400 });
  }

  // Verify the milestone belongs to this tracker
  const { data: milestone, error: milestoneError } = await supabase
    .from('tracker_milestones')
    .select('*')
    .eq('id', milestone_id)
    .eq('tracker_id', trackerId)
    .single();

  if (milestoneError || !milestone) {
    return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
  }

  // Build update object
  const updates: Record<string, unknown> = {
    status,
  };

  if (status === 'completed') {
    updates.completed_at = new Date().toISOString();
    updates.completed_by = session.user.id;
  } else if (milestone.status === 'completed' && status !== 'completed') {
    // If changing from completed to something else, clear completion data
    updates.completed_at = null;
    updates.completed_by = null;
  }

  if (customer_notes !== undefined) {
    updates.customer_notes = customer_notes || null;
  }

  if (staff_notes !== undefined) {
    updates.staff_notes = staff_notes || null;
  }

  // Update the milestone
  const { error: updateError } = await supabase
    .from('tracker_milestones')
    .update(updates)
    .eq('id', milestone_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Recalculate tracker progress
  const { data: allMilestones } = await supabase
    .from('tracker_milestones')
    .select('id, status, is_optional')
    .eq('tracker_id', trackerId);

  if (allMilestones) {
    const requiredMilestones = allMilestones.filter((m) => !m.is_optional);
    const completedRequired = requiredMilestones.filter(
      (m) => m.status === 'completed' || m.status === 'skipped'
    );

    const progressPercent =
      requiredMilestones.length > 0
        ? Math.round((completedRequired.length / requiredMilestones.length) * 100)
        : 0;

    // Check if all milestones are done
    const allDone = requiredMilestones.every(
      (m) => m.status === 'completed' || m.status === 'skipped'
    );

    // Find next in_progress milestone for current_milestone_id
    let currentMilestoneId: string | null = null;
    const inProgressMilestone = allMilestones.find((m) => m.status === 'in_progress');
    if (inProgressMilestone) {
      currentMilestoneId = inProgressMilestone.id;
    }

    // Update tracker
    const trackerUpdates: Record<string, unknown> = {
      progress_percent: progressPercent,
      current_milestone_id: currentMilestoneId,
    };

    // Auto-complete tracker if all milestones are done
    if (allDone) {
      trackerUpdates.status = 'completed';
      trackerUpdates.actual_completion = new Date().toISOString().split('T')[0];
      trackerUpdates.progress_percent = 100;
    }

    await supabase.from('job_trackers').update(trackerUpdates).eq('id', trackerId);

    // Log activity
    await supabase.from('tracker_activity').insert({
      tracker_id: trackerId,
      activity_type: 'milestone_updated',
      description: `"${milestone.name}" marked as ${status}`,
      old_value: milestone.status,
      new_value: status,
      performed_by: session.user.id,
    });

    // Get updated tracker to return
    const { data: updatedTracker } = await supabase
      .from('job_trackers')
      .select('status, progress_percent')
      .eq('id', trackerId)
      .single();

    return NextResponse.json({
      success: true,
      progress_percent: updatedTracker?.progress_percent || progressPercent,
      status: updatedTracker?.status || 'active',
    });
  }

  return NextResponse.json({ success: true, progress_percent: 0, status: 'active' });
}
