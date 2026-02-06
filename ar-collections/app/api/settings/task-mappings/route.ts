import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

/**
 * GET /api/settings/task-mappings
 * Get AR task type to ST task type/source mappings
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only managers/owners can view mappings
    const role = (session.user as { role?: string }).role;
    if (role !== 'owner' && role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServerSupabase();

    const { data, error } = await supabase
      .from('ar_task_type_mappings')
      .select('*')
      .order('ar_task_type');

    if (error) {
      console.error('Error fetching task mappings:', error);
      return NextResponse.json({ error: 'Failed to fetch mappings' }, { status: 500 });
    }

    return NextResponse.json({ mappings: data || [] });
  } catch (error) {
    console.error('Task mappings API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/task-mappings
 * Update an AR task type mapping
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only owners can update mappings
    const role = (session.user as { role?: string }).role;
    if (role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { ar_task_type, st_type_id, st_source_id } = body;

    if (!ar_task_type) {
      return NextResponse.json({ error: 'ar_task_type is required' }, { status: 400 });
    }

    const validTypes = ['call', 'email', 'letter', 'escalation'];
    if (!validTypes.includes(ar_task_type)) {
      return NextResponse.json({ error: 'Invalid ar_task_type' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    const { data, error } = await supabase
      .from('ar_task_type_mappings')
      .update({
        st_type_id: st_type_id || null,
        st_source_id: st_source_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('ar_task_type', ar_task_type)
      .select()
      .single();

    if (error) {
      console.error('Error updating task mapping:', error);
      return NextResponse.json({ error: 'Failed to update mapping' }, { status: 500 });
    }

    return NextResponse.json({ mapping: data });
  } catch (error) {
    console.error('Task mappings API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
