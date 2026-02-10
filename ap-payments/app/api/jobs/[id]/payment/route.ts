import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function PATCH(
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
  const { payment_status, payment_amount, payment_expected_date, payment_notes } = body;

  const validStatuses = ['none', 'requested', 'approved', 'paid'];
  if (payment_status && !validStatuses.includes(payment_status)) {
    return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Get current state
  const { data: currentJob } = await supabase
    .from('ap_install_jobs')
    .select('payment_status, payment_amount, contractor_id')
    .eq('id', id)
    .single();

  if (!currentJob) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Build update
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payment_status !== undefined) {
    updateData.payment_status = payment_status;

    if (payment_status === 'requested') {
      updateData.payment_requested_at = new Date().toISOString();
    } else if (payment_status === 'approved') {
      updateData.payment_approved_at = new Date().toISOString();
      updateData.payment_approved_by = session.user.id;
    } else if (payment_status === 'paid') {
      updateData.payment_paid_at = new Date().toISOString();
    }
  }

  if (payment_amount !== undefined) {
    updateData.payment_amount = payment_amount;
  }

  if (payment_expected_date !== undefined) {
    updateData.payment_expected_date = payment_expected_date;
  }

  if (payment_notes !== undefined) {
    updateData.payment_notes = payment_notes;
  }

  const { data: updated, error } = await supabase
    .from('ap_install_jobs')
    .update(updateData)
    .eq('id', id)
    .select(`*, contractor:ap_contractors(id, name)`)
    .single();

  if (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity
  let action = 'amount_changed';
  let description = '';

  if (payment_status && payment_status !== currentJob.payment_status) {
    action = `payment_${payment_status}`;
    description = `Payment status changed from ${currentJob.payment_status} to ${payment_status}`;
    if (payment_amount) {
      description += ` ($${payment_amount})`;
    }
  } else if (payment_amount !== undefined && payment_amount !== currentJob.payment_amount) {
    action = 'amount_changed';
    description = `Payment amount changed from $${currentJob.payment_amount || 0} to $${payment_amount}`;
  }

  if (description) {
    await supabase.from('ap_activity_log').insert({
      job_id: id,
      contractor_id: currentJob.contractor_id,
      action,
      description,
      old_value: JSON.stringify({
        payment_status: currentJob.payment_status,
        payment_amount: currentJob.payment_amount,
      }),
      new_value: JSON.stringify({
        payment_status: payment_status || currentJob.payment_status,
        payment_amount: payment_amount ?? currentJob.payment_amount,
      }),
      performed_by: session.user.id,
    });
  }

  return NextResponse.json(updated);
}
