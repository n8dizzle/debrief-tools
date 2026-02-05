import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

/**
 * GET /api/settings/job-statuses
 * Get all job statuses (active only by default)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const supabase = getServerSupabase();

    let query = supabase
      .from('ar_job_statuses')
      .select('*')
      .order('sort_order', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching job statuses:', error);
      return NextResponse.json({ error: 'Failed to fetch job statuses' }, { status: 500 });
    }

    return NextResponse.json({ statuses: data });
  } catch (error) {
    console.error('Job statuses API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/settings/job-statuses
 * Create a new job status
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only owners can manage job statuses
    const role = (session.user as { role?: string }).role;
    if (role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { key, label } = body;

    if (!key || !label) {
      return NextResponse.json({ error: 'Key and label are required' }, { status: 400 });
    }

    // Sanitize key to be lowercase with underscores
    const sanitizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

    const supabase = getServerSupabase();

    // Get max sort order
    const { data: maxOrder } = await supabase
      .from('ar_job_statuses')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const newSortOrder = (maxOrder?.sort_order || 0) + 1;

    const { data, error } = await supabase
      .from('ar_job_statuses')
      .insert({
        key: sanitizedKey,
        label,
        sort_order: newSortOrder,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A status with this key already exists' }, { status: 400 });
      }
      console.error('Error creating job status:', error);
      return NextResponse.json({ error: 'Failed to create job status' }, { status: 500 });
    }

    return NextResponse.json({ status: data });
  } catch (error) {
    console.error('Job statuses API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/job-statuses
 * Update job status or reorder
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only owners can manage job statuses
    const role = (session.user as { role?: string }).role;
    if (role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, label, is_active, reorder } = body;

    const supabase = getServerSupabase();

    // Handle reordering
    if (reorder && Array.isArray(reorder)) {
      for (let i = 0; i < reorder.length; i++) {
        await supabase
          .from('ar_job_statuses')
          .update({ sort_order: i + 1, updated_at: new Date().toISOString() })
          .eq('id', reorder[i]);
      }
      return NextResponse.json({ success: true });
    }

    // Handle single update
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (label !== undefined) updates.label = label;
    if (is_active !== undefined) updates.is_active = is_active;
    if (body.control_bucket !== undefined) updates.control_bucket = body.control_bucket;

    const { data, error } = await supabase
      .from('ar_job_statuses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating job status:', error);
      return NextResponse.json({ error: 'Failed to update job status' }, { status: 500 });
    }

    return NextResponse.json({ status: data });
  } catch (error) {
    console.error('Job statuses API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/settings/job-statuses
 * Delete a job status (soft delete by setting is_active=false)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only owners can manage job statuses
    const role = (session.user as { role?: string }).role;
    if (role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // Soft delete by setting is_active=false
    const { error } = await supabase
      .from('ar_job_statuses')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error deleting job status:', error);
      return NextResponse.json({ error: 'Failed to delete job status' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Job statuses API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
