import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasPermission } from '@/lib/permissions';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tasks/[id]
 * Get a single task
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role, permissions } = session.user as {
    role: 'employee' | 'manager' | 'owner';
    permissions: any;
  };

  if (!hasPermission(role, permissions, 'marketing_hub', 'can_manage_tasks')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('marketing_tasks')
    .select(`
      *,
      assigned_to_user:portal_users!assigned_to(id, name, email),
      completed_by_user:portal_users!completed_by(id, name, email),
      created_by_user:portal_users!created_by(id, name, email)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/tasks/[id]
 * Update a task
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: userId, role, permissions } = session.user as {
    id: string;
    role: 'employee' | 'manager' | 'owner';
    permissions: any;
  };

  if (!hasPermission(role, permissions, 'marketing_hub', 'can_manage_tasks')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const supabase = getServerSupabase();

  const {
    title,
    description,
    task_type,
    category,
    status,
    due_date,
    recurrence_day,
    assigned_to,
    notes,
  } = body;

  // Build update object
  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (task_type !== undefined) {
    if (!['daily', 'weekly', 'monthly', 'one_time'].includes(task_type)) {
      return NextResponse.json({ error: 'Invalid task type' }, { status: 400 });
    }
    updates.task_type = task_type;
  }
  if (category !== undefined) {
    if (category && !['social', 'gbp', 'reviews', 'reporting', 'other'].includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }
    updates.category = category;
  }
  if (status !== undefined) {
    if (!['pending', 'in_progress', 'completed', 'skipped'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    updates.status = status;

    // Set completed_at and completed_by when marking as completed or skipped
    if (status === 'completed' || status === 'skipped') {
      updates.completed_at = new Date().toISOString();
      updates.completed_by = userId;
    } else {
      // Clear completed info if changing status back
      updates.completed_at = null;
      updates.completed_by = null;
    }
  }
  if (due_date !== undefined) updates.due_date = due_date;
  if (recurrence_day !== undefined) updates.recurrence_day = recurrence_day;
  if (assigned_to !== undefined) updates.assigned_to = assigned_to;
  if (notes !== undefined) updates.notes = notes;

  const { data, error } = await supabase
    .from('marketing_tasks')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      assigned_to_user:portal_users!assigned_to(id, name, email),
      completed_by_user:portal_users!completed_by(id, name, email),
      created_by_user:portal_users!created_by(id, name, email)
    `)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    console.error('Failed to update task:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/tasks/[id]
 * Delete a task
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role, permissions } = session.user as {
    role: 'employee' | 'manager' | 'owner';
    permissions: any;
  };

  if (!hasPermission(role, permissions, 'marketing_hub', 'can_manage_tasks')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();

  // Check if task exists
  const { data: existing, error: fetchError } = await supabase
    .from('marketing_tasks')
    .select('id')
    .eq('id', id)
    .single();

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const { error: deleteError } = await supabase
    .from('marketing_tasks')
    .delete()
    .eq('id', id);

  if (deleteError) {
    console.error('Failed to delete task:', deleteError);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
