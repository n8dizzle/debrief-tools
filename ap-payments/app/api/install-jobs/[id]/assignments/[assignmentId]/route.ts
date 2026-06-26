import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

/**
 * PATCH /api/install-jobs/[id]/assignments/[assignmentId] — set/freeze a person's pay.
 * Body: { pay_type_id, pay_amount, pay_basis }. The amount is the human-confirmed number;
 * pay_basis is the snapshot of how it was derived (method + rates + inputs) so later
 * rate edits never rewrite this job. See the SNAPSHOT/LOCK principle in the install-jobs memory.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_assignments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: jobId, assignmentId } = await params;
  const body = await request.json();
  const supabase = getServerSupabase();

  const { data: existing } = await supabase
    .from('ap_job_assignments')
    .select(`id, assignee_type, pay_amount, technician:ap_technicians(name), contractor:ap_contractors(name)`)
    .eq('id', assignmentId)
    .eq('job_id', jobId)
    .single();
  if (!existing) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

  const updates: Record<string, unknown> = { updated_by: session.user.id, updated_at: new Date().toISOString() };
  if (body.pay_type_id !== undefined) updates.pay_type_id = body.pay_type_id || null;
  if (body.pay_amount !== undefined) updates.pay_amount = body.pay_amount === null || body.pay_amount === '' ? null : Number(body.pay_amount);
  if (body.pay_basis !== undefined) updates.pay_basis = body.pay_basis ?? null;

  const { data, error } = await supabase
    .from('ap_job_assignments')
    .update(updates)
    .eq('id', assignmentId)
    .select('id, pay_type_id, pay_amount, pay_basis')
    .single();
  if (error) {
    console.error('Assignment pay update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const name = (existing as any).assignee_type === 'technician' ? (existing as any).technician?.name : (existing as any).contractor?.name;
  await supabase.from('ap_activity_log').insert({
    job_id: jobId,
    action: 'crew_pay_set',
    description: `Set pay for ${name || 'crew member'} to ${updates.pay_amount != null ? `$${updates.pay_amount}` : '—'}`,
    old_value: JSON.stringify({ pay_amount: (existing as any).pay_amount }),
    new_value: JSON.stringify({ pay_amount: updates.pay_amount }),
    performed_by: session.user.id,
  });

  return NextResponse.json(data);
}

/**
 * DELETE /api/install-jobs/[id]/assignments/[assignmentId] — remove a person from a job.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_assignments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: jobId, assignmentId } = await params;
  const supabase = getServerSupabase();

  const { data: existing } = await supabase
    .from('ap_job_assignments')
    .select(`id, assignee_type, technician:ap_technicians(name), contractor:ap_contractors(name)`)
    .eq('id', assignmentId)
    .eq('job_id', jobId)
    .single();

  if (!existing) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

  const { error } = await supabase.from('ap_job_assignments').delete().eq('id', assignmentId);
  if (error) {
    console.error('Assignment delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const name =
    existing.assignee_type === 'technician' ? (existing as any).technician?.name : (existing as any).contractor?.name;
  await supabase.from('ap_activity_log').insert({
    job_id: jobId,
    action: 'crew_unassigned',
    description: `Removed ${existing.assignee_type === 'technician' ? 'technician' : 'subcontractor'} ${name || ''} from the job`,
    old_value: JSON.stringify({ assignee_type: existing.assignee_type, name }),
    performed_by: session.user.id,
  });

  return NextResponse.json({ success: true });
}
