import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasAPPermission(session, 'can_manage_payments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');
  const contractorId = searchParams.get('contractor_id');
  const paymentStatus = searchParams.get('payment_status');
  const trade = searchParams.get('trade');
  const format = searchParams.get('format') || 'json';

  const supabase = getServerSupabase();

  let query = supabase
    .from('ap_install_jobs')
    .select(`
      job_number,
      customer_name,
      trade,
      job_type_name,
      job_total,
      assignment_type,
      payment_status,
      payment_amount,
      payment_notes,
      payment_received_at,
      payment_approved_at,
      payment_approved_by,
      payment_paid_at,
      payment_paid_by,
      invoice_source,
      completed_on,
      contractor:ap_contractors(name),
      approver:portal_users!ap_install_jobs_payment_approved_by_fkey(name, email),
      payer:portal_users!ap_install_jobs_payment_paid_by_fkey(name, email)
    `)
    .in('assignment_type', ['contractor'])
    .not('payment_status', 'eq', 'none')
    .order('completed_on', { ascending: false });

  if (startDate) query = query.gte('completed_on', startDate);
  if (endDate) query = query.lte('completed_on', endDate);
  if (contractorId) query = query.eq('contractor_id', contractorId);
  if (paymentStatus) query = query.eq('payment_status', paymentStatus);
  if (trade) query = query.eq('trade', trade);

  const { data, error } = await query;

  if (error) {
    console.error('Report query error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []).map((row: any) => ({
    job_number: row.job_number,
    customer_name: row.customer_name,
    trade: row.trade,
    job_type: row.job_type_name,
    job_total: row.job_total,
    contractor: row.contractor?.name || '',
    payment_status: row.payment_status,
    payment_amount: row.payment_amount,
    invoice_source: row.invoice_source,
    payment_notes: row.payment_notes || '',
    completed_on: row.completed_on,
    approved_by: row.approver?.name || row.approver?.email || '',
    approved_at: row.payment_approved_at || '',
    paid_by: row.payer?.name || row.payer?.email || '',
    paid_at: row.payment_paid_at || '',
  }));

  if (format === 'csv') {
    const headers = [
      'Job #', 'Customer', 'Trade', 'Job Type', 'Job Total', 'Contractor',
      'Payment Status', 'Payment Amount', 'Invoice Source', 'Notes',
      'Completed', 'Approved By', 'Approved At', 'Paid By', 'Paid At',
    ];

    const csvRows = rows.map((r: any) => [
      r.job_number,
      `"${(r.customer_name || '').replace(/"/g, '""')}"`,
      r.trade,
      r.job_type,
      r.job_total,
      `"${r.contractor.replace(/"/g, '""')}"`,
      r.payment_status,
      r.payment_amount,
      r.invoice_source,
      `"${r.payment_notes.replace(/"/g, '""')}"`,
      r.completed_on,
      `"${r.approved_by.replace(/"/g, '""')}"`,
      r.approved_at,
      `"${r.paid_by.replace(/"/g, '""')}"`,
      r.paid_at,
    ].join(','));

    const csv = [headers.join(','), ...csvRows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="ap-payments-report-${startDate || 'all'}-to-${endDate || 'all'}.csv"`,
      },
    });
  }

  return NextResponse.json({ rows, total: rows.length });
}
