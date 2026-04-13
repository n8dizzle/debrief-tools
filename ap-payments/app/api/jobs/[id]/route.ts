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
      contractor:ap_contractors(*),
      technician:ap_technicians(id, name, hourly_rate)
    `)
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  // Get activity log for this job (paginated)
  const { searchParams } = new URL(request.url);
  const activityLimit = parseInt(searchParams.get('activity_limit') || '50');
  const activityOffset = parseInt(searchParams.get('activity_offset') || '0');

  const { data: activities, count: activityCount } = await supabase
    .from('ap_activity_log')
    .select(`
      *,
      performer:portal_users!ap_activity_log_performed_by_fkey(name, email)
    `, { count: 'exact' })
    .eq('job_id', id)
    .order('created_at', { ascending: false })
    .range(activityOffset, activityOffset + activityLimit - 1);

  // Get approval chain details
  const approvalChain: Record<string, any> = {};
  if (data.payment_approved_by) {
    const { data: approver } = await supabase
      .from('portal_users')
      .select('name, email')
      .eq('id', data.payment_approved_by)
      .single();
    approvalChain.approved_by = approver;
    approvalChain.approved_at = data.payment_approved_at;
  }
  if (data.payment_paid_by) {
    const { data: payer } = await supabase
      .from('portal_users')
      .select('name, email')
      .eq('id', data.payment_paid_by)
      .single();
    approvalChain.paid_by = payer;
    approvalChain.paid_at = data.payment_paid_at;
  }

  return NextResponse.json({
    job: data,
    activities: activities || [],
    activity_total: activityCount || 0,
    approval_chain: approvalChain,
  });
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
