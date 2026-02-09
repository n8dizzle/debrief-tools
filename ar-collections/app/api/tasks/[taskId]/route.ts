import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

/**
 * GET /api/tasks/[taskId]
 * Get a single task
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = await params;
    const supabase = getServerSupabase();

    const { data, error } = await supabase
      .from('ar_collection_tasks')
      .select(`
        *,
        invoice:ar_invoices(id, invoice_number, customer_name, balance, st_job_id, st_invoice_id),
        customer:ar_customers(id, name, st_customer_id),
        assignee:portal_users!ar_collection_tasks_assigned_to_fkey(id, name, email),
        created_by_user:portal_users!ar_collection_tasks_created_by_fkey(id, name),
        completed_by_user:portal_users!ar_collection_tasks_completed_by_fkey(id, name)
      `)
      .eq('id', taskId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      console.error('Error fetching task:', error);
      return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
    }

    return NextResponse.json({ task: data });
  } catch (error) {
    console.error('Task API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/tasks/[taskId]
 * Update a task
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = await params;
    const body = await request.json();

    const {
      title,
      description,
      task_type,
      status,
      priority,
      assigned_to,
      st_assigned_to,
      due_date,
      outcome,
      outcome_notes,
      followup_required,
      followup_date,
    } = body;

    const supabase = getServerSupabase();

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (task_type !== undefined) updates.task_type = task_type;
    if (status !== undefined) updates.status = status;
    if (priority !== undefined) updates.priority = priority;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to || null;
    if (st_assigned_to !== undefined) updates.st_assigned_to = st_assigned_to || null;
    if (due_date !== undefined) updates.due_date = due_date || null;
    if (outcome !== undefined) updates.outcome = outcome;
    if (outcome_notes !== undefined) updates.outcome_notes = outcome_notes;
    if (followup_required !== undefined) updates.followup_required = followup_required;
    if (followup_date !== undefined) updates.followup_date = followup_date || null;

    // Check if task has ST sync and mark for update
    const { data: existing } = await supabase
      .from('ar_collection_tasks')
      .select('st_task_id, sync_status')
      .eq('id', taskId)
      .single();

    if (existing?.st_task_id && existing.sync_status === 'synced') {
      // Mark for push to update ST
      updates.sync_status = 'pending_push';
    }

    const { data, error } = await supabase
      .from('ar_collection_tasks')
      .update(updates)
      .eq('id', taskId)
      .select(`
        *,
        invoice:ar_invoices(id, invoice_number, customer_name, balance, st_job_id),
        customer:ar_customers(id, name, st_customer_id),
        assignee:portal_users!ar_collection_tasks_assigned_to_fkey(id, name, email),
        created_by_user:portal_users!ar_collection_tasks_created_by_fkey(id, name),
        completed_by_user:portal_users!ar_collection_tasks_completed_by_fkey(id, name)
      `)
      .single();

    if (error) {
      console.error('Error updating task:', error);
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }

    return NextResponse.json({ task: data });
  } catch (error) {
    console.error('Task API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/tasks/[taskId]
 * Soft delete a task (set status to cancelled)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = await params;
    const supabase = getServerSupabase();

    const { error } = await supabase
      .from('ar_collection_tasks')
      .update({ status: 'cancelled' })
      .eq('id', taskId);

    if (error) {
      console.error('Error deleting task:', error);
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Task API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
