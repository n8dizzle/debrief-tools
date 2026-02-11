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

  const { id } = await params;
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('ap_install_jobs')
    .select(`
      *,
      contractor:ap_contractors(*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  // Get activity log for this job
  const { data: activities } = await supabase
    .from('ap_activity_log')
    .select(`
      *,
      performer:portal_users!ap_activity_log_performed_by_fkey(name, email)
    `)
    .eq('job_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({ job: data, activities: activities || [] });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const supabase = getServerSupabase();

  // Toggle is_ignored
  if (typeof body.is_ignored === 'boolean') {
    const { data, error } = await supabase
      .from('ap_install_jobs')
      .update({ is_ignored: body.is_ignored, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log activity
    await supabase.from('ap_activity_log').insert({
      job_id: id,
      action: body.is_ignored ? 'job_excluded' : 'job_restored',
      description: body.is_ignored ? 'Job excluded from install tracking' : 'Job restored to install tracking',
      performed_by: (session.user as any).id || null,
    });

    return NextResponse.json({ job: data });
  }

  return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
}
