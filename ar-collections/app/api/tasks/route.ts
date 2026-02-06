import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase, ARTaskStatus, ARTaskPriority } from '@/lib/supabase';

/**
 * GET /api/tasks
 * List tasks with filters
 * By default, only shows tasks for open AR invoices (balance > 0)
 * Use include_closed=true to show all tasks
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('invoice_id');
    const customerId = searchParams.get('customer_id');
    const status = searchParams.get('status') as ARTaskStatus | null;
    const assignedTo = searchParams.get('assigned_to');
    const dueBefore = searchParams.get('due_before');
    const dueAfter = searchParams.get('due_after');
    const stTypeId = searchParams.get('st_type_id');
    const priority = searchParams.get('priority') as ARTaskPriority | null;
    // Note: my_tasks filter removed - ST employees don't map to portal users
    const includeClosed = searchParams.get('include_closed') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = getServerSupabase();
    const userId = (session.user as { id?: string }).id;

    // If filtering to open AR only (default), get open invoice IDs first
    let openInvoiceIds: string[] | null = null;
    if (!includeClosed && !invoiceId) {
      const { data: openInvoices } = await supabase
        .from('ar_invoices')
        .select('id')
        .gt('balance', 0);

      openInvoiceIds = (openInvoices || []).map(inv => inv.id);
    }

    let query = supabase
      .from('ar_collection_tasks')
      .select(`
        *,
        invoice:ar_invoices(id, invoice_number, customer_name, balance, st_job_id),
        customer:ar_customers(id, name, st_customer_id),
        assignee:ar_st_employees!ar_collection_tasks_st_assigned_to_fkey(st_employee_id, name),
        created_by_user:portal_users!ar_collection_tasks_created_by_fkey(id, name),
        completed_by_user:portal_users!ar_collection_tasks_completed_by_fkey(id, name),
        task_type:ar_st_task_types!ar_collection_tasks_st_type_id_fkey(st_type_id, name)
      `, { count: 'exact' })
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    // Apply open AR filter (default behavior)
    // Show tasks for open invoices OR tasks without an invoice (customer-level tasks)
    if (openInvoiceIds !== null) {
      query = query.or(`invoice_id.in.(${openInvoiceIds.join(',')}),invoice_id.is.null`);
    }

    // Apply other filters
    if (invoiceId) {
      query = query.eq('invoice_id', invoiceId);
    }
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (stTypeId) {
      query = query.eq('st_type_id', parseInt(stTypeId));
    }
    if (priority) {
      query = query.eq('priority', priority);
    }
    if (assignedTo) {
      query = query.eq('st_assigned_to', parseInt(assignedTo));
    }
    // Note: "My Tasks" filter removed - ST employees don't map to portal users
    if (dueBefore) {
      query = query.lte('due_date', dueBefore);
    }
    if (dueAfter) {
      query = query.gte('due_date', dueAfter);
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching tasks:', error);
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }

    return NextResponse.json({
      tasks: data || [],
      total: count || 0,
      limit,
      offset,
      openAROnly: !includeClosed,
    });
  } catch (error) {
    console.error('Tasks API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/tasks
 * Create a new task
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      invoice_id,
      customer_id,
      st_type_id,
      title,
      description,
      priority = 'normal',
      st_assigned_to,
      due_date,
      push_to_st = false,
    } = body;

    // Validation
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const userId = (session.user as { id?: string }).id;

    // If invoice_id provided, get ST job info
    let st_job_id: number | null = null;
    let st_customer_id: number | null = null;

    if (invoice_id) {
      const { data: invoice } = await supabase
        .from('ar_invoices')
        .select('st_job_id, st_customer_id')
        .eq('id', invoice_id)
        .single();

      if (invoice) {
        st_job_id = invoice.st_job_id;
        st_customer_id = invoice.st_customer_id;
      }
    }

    // If customer_id provided and no invoice, get ST customer ID
    if (customer_id && !st_customer_id) {
      const { data: customer } = await supabase
        .from('ar_customers')
        .select('st_customer_id')
        .eq('id', customer_id)
        .single();

      if (customer) {
        st_customer_id = customer.st_customer_id;
      }
    }

    // Determine sync status
    const sync_status = push_to_st ? 'pending_push' : 'local';

    const { data, error } = await supabase
      .from('ar_collection_tasks')
      .insert({
        invoice_id,
        customer_id,
        st_type_id,
        title,
        description,
        priority,
        st_assigned_to,
        due_date,
        status: 'pending',
        created_by: userId,
        st_job_id,
        st_customer_id,
        sync_status,
      })
      .select(`
        *,
        invoice:ar_invoices(id, invoice_number, customer_name, balance, st_job_id),
        customer:ar_customers(id, name, st_customer_id),
        assignee:ar_st_employees!ar_collection_tasks_st_assigned_to_fkey(st_employee_id, name),
        task_type:ar_st_task_types!ar_collection_tasks_st_type_id_fkey(st_type_id, name)
      `)
      .single();

    if (error) {
      console.error('Error creating task:', error);
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }

    return NextResponse.json({ task: data }, { status: 201 });
  } catch (error) {
    console.error('Tasks API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
