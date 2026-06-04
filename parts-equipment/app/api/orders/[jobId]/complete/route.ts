import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasPEPermission } from '@/lib/pe-utils';

export async function POST(request: NextRequest, { params }: { params: { jobId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPEPermission(session, 'can_manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { scheduled_date, completed_by } = body;

  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('po_orders')
    .update({
      status: 'completed',
      scheduled_date: scheduled_date || null,
      completed_by: completed_by || session.user.name || session.user.email,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('job_id', params.jobId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('po_audit_log').insert({
    job_id: params.jobId,
    event_type: 'completed',
    action: `Marked complete by ${completed_by || session.user.name}`,
    performed_by: session.user.name || session.user.email,
  });

  return NextResponse.json(data);
}
