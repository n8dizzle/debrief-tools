import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/ap-utils';
import { sendAssignmentNotification } from '@/lib/sms-notifications';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role || 'employee';
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { assignment_type, contractor_id, payment_amount } = body;

  if (!assignment_type || !['in_house', 'contractor', 'unassigned'].includes(assignment_type)) {
    return NextResponse.json({ error: 'Invalid assignment type' }, { status: 400 });
  }

  if (assignment_type === 'contractor' && !contractor_id) {
    return NextResponse.json({ error: 'Contractor is required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Get current job state for activity log
  const { data: currentJob } = await supabase
    .from('ap_install_jobs')
    .select('assignment_type, contractor_id, payment_amount')
    .eq('id', id)
    .single();

  if (!currentJob) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Update job
  const updateData: Record<string, unknown> = {
    assignment_type,
    assigned_by: session.user.id,
    assigned_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (assignment_type === 'contractor') {
    updateData.contractor_id = contractor_id;
    if (payment_amount != null) {
      updateData.payment_amount = payment_amount;
    }
  } else if (assignment_type === 'in_house') {
    updateData.contractor_id = null;
    updateData.payment_amount = null;
    updateData.payment_status = 'none';
    updateData.invoice_source = null;
    updateData.payment_received_at = null;
    updateData.payment_approved_at = null;
    updateData.payment_approved_by = null;
    updateData.payment_paid_at = null;
  } else {
    // unassigned
    updateData.contractor_id = null;
    updateData.payment_amount = null;
    updateData.payment_status = 'none';
    updateData.invoice_source = null;
    updateData.payment_received_at = null;
    updateData.payment_approved_at = null;
    updateData.payment_approved_by = null;
    updateData.payment_paid_at = null;
  }

  const { data: updated, error } = await supabase
    .from('ap_install_jobs')
    .update(updateData)
    .eq('id', id)
    .select(`*, contractor:ap_contractors(id, name)`)
    .single();

  if (error) {
    console.error('Error updating job:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity
  const action = assignment_type === 'unassigned'
    ? 'unassigned'
    : assignment_type === 'in_house'
    ? 'assigned_inhouse'
    : 'assigned_contractor';

  const contractorName = updated?.contractor?.name;
  const description = assignment_type === 'contractor'
    ? `Assigned to ${contractorName}${payment_amount ? ` for ${formatCurrency(payment_amount)}` : ''}`
    : assignment_type === 'in_house'
    ? 'Assigned as in-house'
    : 'Unassigned';

  await supabase.from('ap_activity_log').insert({
    job_id: id,
    contractor_id: assignment_type === 'contractor' ? contractor_id : null,
    action,
    description,
    old_value: JSON.stringify({
      assignment_type: currentJob.assignment_type,
      contractor_id: currentJob.contractor_id,
      payment_amount: currentJob.payment_amount,
    }),
    new_value: JSON.stringify({
      assignment_type,
      contractor_id: contractor_id || null,
      payment_amount: payment_amount || null,
    }),
    performed_by: session.user.id,
  });

  // Fire-and-forget SMS notification for contractor assignments
  if (assignment_type === 'contractor' && contractor_id) {
    sendAssignmentNotification(id, contractor_id, payment_amount, session.user.id)
      .catch(err => console.error('SMS error:', err));
  }

  return NextResponse.json(updated);
}
