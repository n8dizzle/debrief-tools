import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase, ARCollectionTaskExtended } from '@/lib/supabase';
import { syncTaskUpdateToST } from '@/lib/task-sync';

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

    // First, do the update
    const { error: updateError } = await supabase
      .from('ar_collection_tasks')
      .update(updates)
      .eq('id', taskId);

    if (updateError) {
      console.error('Error updating task:', updateError);
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }

    // Fetch the updated task with all relations
    const { data, error: fetchError } = await supabase
      .from('ar_collection_tasks')
      .select(`
        *,
        invoice:ar_invoices(id, invoice_number, customer_name, balance, st_job_id),
        customer:ar_customers(id, name, st_customer_id),
        assignee:portal_users!ar_collection_tasks_assigned_to_fkey(id, name, email),
        created_by_user:portal_users!ar_collection_tasks_created_by_fkey(id, name),
        completed_by_user:portal_users!ar_collection_tasks_completed_by_fkey(id, name)
      `)
      .eq('id', taskId)
      .single();

    if (fetchError) {
      console.error('Error fetching updated task:', JSON.stringify(fetchError, null, 2));

      // Even if the full fetch failed, try to sync to ST with a simpler query
      const { data: simpleTask } = await supabase
        .from('ar_collection_tasks')
        .select('id, st_task_id, sync_status')
        .eq('id', taskId)
        .single();

      if (simpleTask?.st_task_id) {
        try {
          const syncUpdates: {
            status?: string;
            priority?: string;
            title?: string;
            description?: string;
            due_date?: string | null;
            st_assigned_to?: number | null;
            outcome?: string;
            completed_at?: string;
          } = {};

          if (status !== undefined) syncUpdates.status = status;
          if (priority !== undefined) syncUpdates.priority = priority;
          if (title !== undefined) syncUpdates.title = title;
          if (description !== undefined) syncUpdates.description = description;
          if (due_date !== undefined) syncUpdates.due_date = due_date;
          if (st_assigned_to !== undefined) syncUpdates.st_assigned_to = st_assigned_to;
          if (outcome !== undefined) syncUpdates.outcome = outcome;
          if (status === 'completed') syncUpdates.completed_at = new Date().toISOString();

          console.log('Syncing to ST (fallback) with updates:', JSON.stringify(syncUpdates));
          await syncTaskUpdateToST(simpleTask as ARCollectionTaskExtended, syncUpdates);
        } catch (syncError) {
          console.error('Failed to sync task to ST:', syncError);
        }
      }

      return NextResponse.json({
        task: null,
        message: 'Task updated but fetch failed',
        fetchError: fetchError.message || fetchError.code
      });
    }

    // Immediately sync to ServiceTitan if task has ST link
    console.log('Task update - st_task_id:', data?.st_task_id, 'sync_status:', data?.sync_status);
    if (data?.st_task_id) {
      try {
        const syncUpdates: {
          status?: string;
          priority?: string;
          title?: string;
          description?: string;
          due_date?: string | null;
          st_assigned_to?: number | null;
          outcome?: string;
          completed_at?: string;
        } = {};

        if (status !== undefined) syncUpdates.status = status;
        if (priority !== undefined) syncUpdates.priority = priority;
        if (title !== undefined) syncUpdates.title = title;
        if (description !== undefined) syncUpdates.description = description;
        if (due_date !== undefined) syncUpdates.due_date = due_date;
        if (st_assigned_to !== undefined) syncUpdates.st_assigned_to = st_assigned_to;
        if (outcome !== undefined) syncUpdates.outcome = outcome;
        if (status === 'completed') syncUpdates.completed_at = new Date().toISOString();

        console.log('Syncing to ST with updates:', JSON.stringify(syncUpdates));
        const syncResult = await syncTaskUpdateToST(data as ARCollectionTaskExtended, syncUpdates);
        console.log('ST sync result:', syncResult);
      } catch (syncError) {
        console.error('Failed to sync task to ST (non-blocking):', syncError);
        // Don't fail the request if ST sync fails - it will retry on next cron
      }
    } else {
      console.log('Skipping ST sync - no st_task_id');
    }

    return NextResponse.json({ task: data });
  } catch (error) {
    console.error('Task API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Internal server error: ${message}` }, { status: 500 });
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
