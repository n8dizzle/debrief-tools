import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const { id } = await params;

  // Fetch onboarding with department, hiring manager, recruiter
  const { data: onboarding, error } = await supabase
    .from('hr_onboardings')
    .select(`
      *,
      portal_departments(id, name, slug),
      hiring_manager:portal_users!hr_onboardings_hiring_manager_id_fkey(id, name, email),
      recruiter:portal_users!hr_onboardings_recruiter_id_fkey(id, name, email)
    `)
    .eq('id', id)
    .single();

  if (error || !onboarding) {
    return NextResponse.json({ error: 'Onboarding not found' }, { status: 404 });
  }

  // Fetch all tasks
  const { data: tasks } = await supabase
    .from('hr_onboarding_tasks')
    .select(`
      *,
      assigned_user:portal_users!hr_onboarding_tasks_assigned_to_fkey(id, name, email),
      completed_by_user:portal_users!hr_onboarding_tasks_completed_by_fkey(id, name)
    `)
    .eq('onboarding_id', id)
    .order('phase_sort_order', { ascending: true })
    .order('sort_order', { ascending: true });

  // Fetch recent activity log
  const { data: activityLog } = await supabase
    .from('hr_activity_log')
    .select('*, actor:portal_users!hr_activity_log_actor_id_fkey(id, name)')
    .eq('onboarding_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({
    ...onboarding,
    tasks: tasks || [],
    activity_log: activityLog || [],
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const { id } = await params;
  const body = await request.json();

  // Fetch current onboarding to check status changes
  const { data: current } = await supabase
    .from('hr_onboardings')
    .select('status, employee_name')
    .eq('id', id)
    .single();

  if (!current) {
    return NextResponse.json({ error: 'Onboarding not found' }, { status: 404 });
  }

  // Build update object from allowed fields
  const allowedFields = [
    'status', 'notes', 'hiring_manager_id', 'recruiter_id',
    'employee_name', 'employee_email', 'employee_phone',
    'department_id', 'position_title', 'trade', 'start_date',
  ];
  const updates: Record<string, any> = {};
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  // If completing, set completed_at
  if (updates.status === 'completed' && current.status !== 'completed') {
    updates.completed_at = new Date().toISOString();
  }

  // If un-completing, clear completed_at
  if (current.status === 'completed' && updates.status && updates.status !== 'completed') {
    updates.completed_at = null;
  }

  updates.updated_at = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from('hr_onboardings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating onboarding:', error);
    return NextResponse.json({ error: 'Failed to update onboarding' }, { status: 500 });
  }

  // Log status change activity
  if (updates.status && updates.status !== current.status) {
    const actionMap: Record<string, string> = {
      active: 'onboarding_activated',
      paused: 'onboarding_paused',
      completed: 'onboarding_completed',
      cancelled: 'onboarding_cancelled',
      draft: 'onboarding_reverted_to_draft',
    };
    const action = actionMap[updates.status] || 'status_changed';

    await supabase.from('hr_activity_log').insert({
      onboarding_id: id,
      actor_id: session.user.id,
      action,
      details: {
        employee_name: current.employee_name,
        from_status: current.status,
        to_status: updates.status,
      },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const { id } = await params;

  // Check current status - only allow delete for drafts
  const { data: current } = await supabase
    .from('hr_onboardings')
    .select('status, employee_name')
    .eq('id', id)
    .single();

  if (!current) {
    return NextResponse.json({ error: 'Onboarding not found' }, { status: 404 });
  }

  if (current.status !== 'draft') {
    return NextResponse.json(
      { error: 'Only draft onboardings can be deleted' },
      { status: 400 }
    );
  }

  // Delete tasks first (cascade may handle this, but be explicit)
  await supabase
    .from('hr_onboarding_tasks')
    .delete()
    .eq('onboarding_id', id);

  // Delete activity log
  await supabase
    .from('hr_activity_log')
    .delete()
    .eq('onboarding_id', id);

  // Delete the onboarding
  const { error } = await supabase
    .from('hr_onboardings')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting onboarding:', error);
    return NextResponse.json({ error: 'Failed to delete onboarding' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
