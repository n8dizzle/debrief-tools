import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

/**
 * GET /api/contractors/[id]/history
 * Returns payment history (actual jobs paid) and rate change history for a contractor.
 */
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

  // Fetch completed/paid jobs for this contractor (actual payment history)
  const { data: paymentJobs } = await supabase
    .from('ap_install_jobs')
    .select('id, job_number, trade, job_type_name, business_unit_name, customer_name, payment_amount, payment_status, payment_paid_at, completed_date, scheduled_date')
    .eq('contractor_id', id)
    .neq('assignment_type', 'unassigned')
    .order('completed_date', { ascending: false, nullsFirst: false });

  // Fetch rate change history
  const { data: rateHistory } = await supabase
    .from('ap_contractor_rate_history')
    .select('*')
    .eq('contractor_id', id)
    .order('created_at', { ascending: false });

  // Compute avg payment by trade and job type
  const jobs = paymentJobs || [];
  const paidJobs = jobs.filter(j => j.payment_status === 'paid' && j.payment_amount);
  const avgByType: Record<string, { trade: string; job_type: string; count: number; total: number; avg: number }> = {};

  for (const j of paidJobs) {
    const key = `${j.trade}|${j.job_type_name || 'Unknown'}`;
    if (!avgByType[key]) {
      avgByType[key] = { trade: j.trade, job_type: j.job_type_name || 'Unknown', count: 0, total: 0, avg: 0 };
    }
    avgByType[key].count += 1;
    avgByType[key].total += j.payment_amount;
  }

  for (const key of Object.keys(avgByType)) {
    avgByType[key].avg = avgByType[key].total / avgByType[key].count;
  }

  return NextResponse.json({
    payments: jobs,
    rateHistory: rateHistory || [],
    averages: Object.values(avgByType),
  });
}
