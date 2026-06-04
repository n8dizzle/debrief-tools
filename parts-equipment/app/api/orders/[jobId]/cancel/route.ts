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
  const { cancel_source, cancel_reason } = body;

  if (!cancel_source) {
    return NextResponse.json({ error: 'cancel_source is required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('po_orders')
    .update({
      status: 'cancelled',
      cancel_source,
      cancel_reason: cancel_reason || null,
      location: 'Cancel PO',
      completed_by: session.user.name || session.user.email,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('job_id', params.jobId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('po_audit_log').insert({
    job_id: params.jobId,
    event_type: 'cancelled',
    action: `Cancelled: ${cancel_source}`,
    detail: cancel_reason || null,
    performed_by: session.user.name || session.user.email,
  });

  return NextResponse.json(data);
}
