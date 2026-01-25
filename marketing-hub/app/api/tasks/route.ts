import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasPermission } from '@/lib/permissions';

/**
 * GET /api/tasks
 * List all marketing tasks
 */
export async function GET(request: NextRequest) {
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

  const supabase = getServerSupabase();
  const { searchParams } = new URL(request.url);

  // Parse query parameters
  const status = searchParams.get('status'); // pending, in_progress, completed, skipped
  const category = searchParams.get('category'); // social, gbp, reviews, reporting, other
  const dueDate = searchParams.get('due_date'); // YYYY-MM-DD
  const assignedTo = searchParams.get('assigned_to'); // user ID
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  let query = supabase
    .from('marketing_tasks')
    .select(`
      *,
      assigned_to_user:portal_users!assigned_to(id, name, email),
      completed_by_user:portal_users!completed_by(id, name, email),
      created_by_user:portal_users!created_by(id, name, email)
    `, { count: 'exact' });

  // Apply filters
  if (status) {
    query = query.eq('status', status);
  }
  if (category) {
    query = query.eq('category', category);
  }
  if (dueDate) {
    query = query.eq('due_date', dueDate);
  }
  if (assignedTo) {
    query = query.eq('assigned_to', assignedTo);
  }

  // Order by due date (nulls last), then by created_at
  const { data, error, count } = await query
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Failed to fetch tasks:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    tasks: data || [],
    total: count,
    limit,
    offset,
  });
}

/**
 * POST /api/tasks
 * Create a new task
 */
export async function POST(request: NextRequest) {
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

  const body = await request.json();
  const {
    title,
    description,
    task_type,
    category,
    due_date,
    recurrence_day,
    assigned_to,
    notes,
  } = body;

  // Validate required fields
  if (!title || !task_type) {
    return NextResponse.json(
      { error: 'Title and task type are required' },
      { status: 400 }
    );
  }

  // Validate task_type
  if (!['daily', 'weekly', 'monthly', 'one_time'].includes(task_type)) {
    return NextResponse.json(
      { error: 'Invalid task type' },
      { status: 400 }
    );
  }

  // Validate category if provided
  if (category && !['social', 'gbp', 'reviews', 'reporting', 'other'].includes(category)) {
    return NextResponse.json(
      { error: 'Invalid category' },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('marketing_tasks')
    .insert({
      title,
      description: description || null,
      task_type,
      category: category || null,
      due_date: due_date || null,
      recurrence_day: recurrence_day ?? null,
      assigned_to: assigned_to || null,
      notes: notes || null,
      created_by: userId,
      status: 'pending',
    })
    .select(`
      *,
      assigned_to_user:portal_users!assigned_to(id, name, email),
      created_by_user:portal_users!created_by(id, name, email)
    `)
    .single();

  if (error) {
    console.error('Failed to create task:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
