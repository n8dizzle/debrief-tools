import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = (session.user as any).role || 'employee';
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { job_ids, is_ignored } = body;

  if (!Array.isArray(job_ids) || job_ids.length === 0) {
    return NextResponse.json({ error: 'job_ids must be a non-empty array' }, { status: 400 });
  }

  if (typeof is_ignored !== 'boolean') {
    return NextResponse.json({ error: 'is_ignored must be a boolean' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const userId = (session.user as any).id || null;

  // Update all jobs in one query
  const { error } = await supabase
    .from('ap_install_jobs')
    .update({ is_ignored, updated_at: new Date().toISOString() })
    .in('id', job_ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity for each job
  const action = is_ignored ? 'job_excluded' : 'job_restored';
  const description = is_ignored
    ? 'Job excluded from install tracking (bulk)'
    : 'Job restored to install tracking (bulk)';

  const activityRows = job_ids.map((jobId: string) => ({
    job_id: jobId,
    action,
    description,
    performed_by: userId,
  }));

  await supabase.from('ap_activity_log').insert(activityRows);

  return NextResponse.json({ success: true, updated: job_ids.length });
}
