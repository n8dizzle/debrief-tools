import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { formatCurrency, hasAPPermission } from '@/lib/ap-utils';
import { sendPaymentStatusNotification } from '@/lib/sms-notifications';

function hasPermission(session: any, perm: string): boolean {
  if (session.user.role === 'owner') return true;
  return !!session.user.permissions?.ap_payments?.[perm];
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasAPPermission(session, 'can_manage_payments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const role = session.user.role || 'employee';

  const { id } = await params;
  const body = await request.json();
  const { payment_status, payment_amount, payment_expected_date, payment_notes, invoice_source } = body;

  const validStatuses = ['none', 'pending_approval', 'ready_to_pay', 'paid'];
  if (payment_status && !validStatuses.includes(payment_status)) {
    return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 });
  }

  const validSources = ['manager_text', 'ap_email'];
  if (invoice_source && !validSources.includes(invoice_source)) {
    return NextResponse.json({ error: 'Invalid invoice source' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Get current state
  const { data: currentJob } = await supabase
    .from('ap_install_jobs')
    .select('payment_status, payment_amount, contractor_id, invoice_source, payment_approved_by')
    .eq('id', id)
    .single();

  if (!currentJob) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // --- APPROVAL ENFORCEMENT ---
  if (payment_status && payment_status !== currentJob.payment_status) {
    // Approving payment (moving to ready_to_pay)
    if (payment_status === 'ready_to_pay' && (currentJob.payment_status === 'none' || currentJob.payment_status === 'pending_approval')) {
      if (!hasPermission(session, 'can_approve_payments')) {
        return NextResponse.json({ error: 'You do not have permission to approve payments. Contact a manager.' }, { status: 403 });
      }
      // Require notes when approving
      if (!payment_notes?.trim()) {
        return NextResponse.json({ error: 'Approval notes are required when approving a payment.' }, { status: 400 });
      }
    }

    // Issuing payment (marking as paid)
    if (payment_status === 'paid') {
      if (!hasPermission(session, 'can_issue_payments')) {
        return NextResponse.json({ error: 'You do not have permission to issue payments. Contact AP.' }, { status: 403 });
      }
      // Prevent same person from approving and paying (unless owner)
      if (currentJob.payment_approved_by === session.user.id && role !== 'owner') {
        return NextResponse.json({ error: 'The same person cannot both approve and issue a payment.' }, { status: 403 });
      }
      // Require notes when marking paid
      if (!payment_notes?.trim()) {
        return NextResponse.json({ error: 'Payment notes are required when issuing a payment.' }, { status: 400 });
      }
    }

    // Rejection (moving back to none from ready_to_pay)
    if (payment_status === 'none' && currentJob.payment_status === 'ready_to_pay') {
      if (!hasPermission(session, 'can_approve_payments') && !hasPermission(session, 'can_issue_payments')) {
        return NextResponse.json({ error: 'You do not have permission to reject payments.' }, { status: 403 });
      }
      if (!payment_notes?.trim()) {
        return NextResponse.json({ error: 'A rejection reason is required.' }, { status: 400 });
      }
    }
  }

  // Build update
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  const effectiveStatus = payment_status;
  const effectiveSource = invoice_source || currentJob.invoice_source;

  if (payment_status !== undefined) {
    if (invoice_source) {
      updateData.invoice_source = invoice_source;
    }

    if (payment_status === 'ready_to_pay') {
      updateData.payment_received_at = new Date().toISOString();
      updateData.payment_approved_at = new Date().toISOString();
      updateData.payment_approved_by = session.user.id;
    } else if (payment_status === 'pending_approval') {
      updateData.payment_received_at = new Date().toISOString();
      if (currentJob.payment_status === 'paid') {
        updateData.payment_paid_at = null;
        updateData.payment_paid_by = null;
      }
    } else if (payment_status === 'paid') {
      updateData.payment_paid_at = new Date().toISOString();
      updateData.payment_paid_by = session.user.id;
    } else if (payment_status === 'none') {
      // Reset all payment timestamps
      updateData.payment_received_at = null;
      updateData.payment_approved_at = null;
      updateData.payment_approved_by = null;
      updateData.payment_paid_at = null;
      updateData.payment_paid_by = null;
      updateData.invoice_source = null;
    }

    // If approving from pending_approval → ready_to_pay
    if (currentJob.payment_status === 'pending_approval' && payment_status === 'ready_to_pay') {
      updateData.payment_approved_at = new Date().toISOString();
      updateData.payment_approved_by = session.user.id;
    }
    // If reverting from paid → ready_to_pay, clear paid timestamp
    if (currentJob.payment_status === 'paid' && payment_status === 'ready_to_pay') {
      updateData.payment_paid_at = null;
      updateData.payment_paid_by = null;
    }

    updateData.payment_status = effectiveStatus;
  }

  if (invoice_source !== undefined && payment_status === undefined) {
    updateData.invoice_source = invoice_source;
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

  if (payment_status && effectiveStatus !== currentJob.payment_status) {
    // Rejection
    if (payment_status === 'none' && currentJob.payment_status === 'ready_to_pay') {
      action = 'payment_rejected';
      description = `Payment rejected: ${payment_notes?.trim() || 'No reason given'}`;
    } else {
      action = `payment_${effectiveStatus}`;
      description = `Payment status changed to ${effectiveStatus}`;
      if (invoice_source) {
        description += ` (via ${invoice_source === 'manager_text' ? 'manager text' : 'AP email'})`;
      }
      if (payment_amount) {
        description += ` (${formatCurrency(payment_amount)})`;
      }
    }
    // Append notes to description for audit trail
    if (payment_notes?.trim() && action !== 'payment_rejected') {
      description += ` — Note: ${payment_notes.trim()}`;
    }
  } else if (payment_amount !== undefined && payment_amount !== currentJob.payment_amount) {
    action = 'amount_changed';
    description = `Payment amount changed from ${formatCurrency(currentJob.payment_amount)} to ${formatCurrency(payment_amount)}`;
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
        payment_status: effectiveStatus || currentJob.payment_status,
        payment_amount: payment_amount ?? currentJob.payment_amount,
      }),
      performed_by: session.user.id,
    });
  }

  // Fire-and-forget SMS notification for payment status changes
  if (effectiveStatus && effectiveStatus !== currentJob.payment_status && effectiveStatus !== 'none' && currentJob.contractor_id) {
    sendPaymentStatusNotification(id, effectiveStatus, payment_amount ?? currentJob.payment_amount, session.user.id, effectiveSource)
      .catch(err => console.error('SMS error:', err));
  }

  return NextResponse.json(updated);
}
