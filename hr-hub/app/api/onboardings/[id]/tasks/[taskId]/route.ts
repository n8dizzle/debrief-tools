import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const { id, taskId } = await params;
  const body = await request.json();

  // Verify task belongs to this onboarding
  const { data: task } = await supabase
    .from('hr_onboarding_tasks')
    .select('*, hr_onboardings!inner(status)')
    .eq('id', taskId)
    .eq('onboarding_id', id)
    .single();

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const role = session.user.role || 'employee';
  const permissions = session.user.permissions?.hr_hub || {};

  // Permission check: non-owners without can_complete_any_task can only complete tasks assigned to them
  if (
    body.status &&
    body.status !== task.status &&
    role !== 'owner' &&
    !permissions.can_complete_any_task
  ) {
    if (task.assigned_to !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only update tasks assigned to you' },
        { status: 403 }
      );
    }
  }

  // Build update object
  const updates: Record<string, any> = {};
  if ('status' in body) updates.status = body.status;
  if ('notes' in body) updates.notes = body.notes;
  if ('assigned_to' in body) updates.assigned_to = body.assigned_to;

  // Handle status-specific fields
  if (body.status === 'completed') {
    updates.completed_at = new Date().toISOString();
    updates.completed_by = session.user.id;
  } else if (body.status === 'na' || body.status === 'skipped') {
    updates.completed_at = null;
    updates.completed_by = null;
  }

  updates.updated_at = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from('hr_onboarding_tasks')
    .update(updates)
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }

  // Log activity for status changes
  if (body.status && body.status !== task.status) {
    await supabase.from('hr_activity_log').insert({
      onboarding_id: id,
      task_id: taskId,
      actor_id: session.user.id,
      action: 'task_status_changed',
      details: {
        task_title: task.title,
        from_status: task.status,
        to_status: body.status,
      },
    });
  }

  return NextResponse.json(updated);
}
