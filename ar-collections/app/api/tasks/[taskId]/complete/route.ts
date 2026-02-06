import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

/**
 * POST /api/tasks/[taskId]/complete
 * Complete a task with outcome
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = await params;
    const body = await request.json();

    const {
      outcome,
      outcome_notes,
      followup_required = false,
      followup_date,
      create_followup_task = false,
      followup_task_type,
      followup_task_title,
      followup_task_description,
    } = body;

    const supabase = getServerSupabase();
    const userId = (session.user as { id?: string }).id;

    // Get the task to complete
    const { data: task, error: fetchError } = await supabase
      .from('ar_collection_tasks')
      .select('*, invoice:ar_invoices(id, invoice_number, st_job_id, st_customer_id)')
      .eq('id', taskId)
      .single();

    if (fetchError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check if already completed
    if (task.status === 'completed') {
      return NextResponse.json({ error: 'Task is already completed' }, { status: 400 });
    }

    // Build update object
    const updates: Record<string, unknown> = {
      status: 'completed',
      outcome,
      outcome_notes,
      followup_required,
      followup_date: followup_date || null,
      completed_at: new Date().toISOString(),
      completed_by: userId,
    };

    // If task is synced with ST, mark for push
    if (task.st_task_id && task.sync_status === 'synced') {
      updates.sync_status = 'pending_push';
    }

    // Update the task
    const { data: completedTask, error: updateError } = await supabase
      .from('ar_collection_tasks')
      .update(updates)
      .eq('id', taskId)
      .select(`
        *,
        invoice:ar_invoices(id, invoice_number, customer_name, balance, st_job_id),
        customer:ar_customers(id, name, st_customer_id),
        assignee:portal_users!ar_collection_tasks_assigned_to_fkey(id, name, email),
        completed_by_user:portal_users!ar_collection_tasks_completed_by_fkey(id, name)
      `)
      .single();

    if (updateError) {
      console.error('Error completing task:', updateError);
      return NextResponse.json({ error: 'Failed to complete task' }, { status: 500 });
    }

    let followupTask = null;

    // Create follow-up task if requested
    if (create_followup_task && followup_task_type && followup_task_title) {
      const { data: newTask, error: createError } = await supabase
        .from('ar_collection_tasks')
        .insert({
          invoice_id: task.invoice_id,
          customer_id: task.customer_id,
          task_type: followup_task_type,
          title: followup_task_title,
          description: followup_task_description || `Follow-up from task: ${task.title}`,
          priority: task.priority,
          assigned_to: task.assigned_to,
          due_date: followup_date,
          status: 'pending',
          created_by: userId,
          st_job_id: task.st_job_id,
          st_customer_id: task.st_customer_id,
          sync_status: 'local',
        })
        .select(`
          *,
          invoice:ar_invoices(id, invoice_number, customer_name, balance),
          assignee:portal_users!ar_collection_tasks_assigned_to_fkey(id, name, email)
        `)
        .single();

      if (createError) {
        console.error('Error creating follow-up task:', createError);
        // Don't fail the whole request, just log it
      } else {
        followupTask = newTask;
      }
    }

    // Create a collection note for the completed task
    const userName = (session.user as { name?: string }).name || 'Unknown';
    const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    await supabase
      .from('ar_collection_notes')
      .insert({
        invoice_id: task.invoice_id,
        customer_id: task.customer_id,
        note_date: new Date().toISOString().split('T')[0],
        author_initials: initials,
        content: `Task completed: ${task.title}${outcome ? ` - ${outcome}` : ''}${outcome_notes ? ` (${outcome_notes})` : ''}`,
        note_type: 'task',
        created_by: userId,
      });

    return NextResponse.json({
      task: completedTask,
      followup_task: followupTask,
    });
  } catch (error) {
    console.error('Task complete API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
