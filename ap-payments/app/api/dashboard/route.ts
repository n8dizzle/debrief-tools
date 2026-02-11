import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase, APDashboardStats, APMonthlyTrend } from '@/lib/supabase';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  const supabase = getServerSupabase();

  // Get job counts by assignment type
  let query = supabase
    .from('ap_install_jobs')
    .select('assignment_type, payment_status, payment_amount, contractor_id, job_total, completed_date')
    .eq('is_ignored', false)
    .or('job_total.gt.0,job_status.neq.Completed');

  if (start) query = query.gte('completed_date', start);
  if (end) query = query.lte('completed_date', end);

  const { data: jobs } = await query;

  const allJobs = jobs || [];

  const unassigned = allJobs.filter(j => j.assignment_type === 'unassigned').length;
  const contractor = allJobs.filter(j => j.assignment_type === 'contractor').length;
  const inHouse = allJobs.filter(j => j.assignment_type === 'in_house').length;

  const requested = allJobs.filter(j => j.payment_status === 'requested').length;
  const approved = allJobs.filter(j => j.payment_status === 'approved').length;
  const paid = allJobs.filter(j => j.payment_status === 'paid').length;

  const totalOutstanding = allJobs
    .filter(j => j.assignment_type === 'contractor' && j.payment_status !== 'paid' && j.payment_status !== 'none')
    .reduce((sum, j) => sum + (j.payment_amount || 0), 0);

  const totalPaid = allJobs
    .filter(j => j.payment_status === 'paid')
    .reduce((sum, j) => sum + (j.payment_amount || 0), 0);

  // Contractor % = sum(payment_amount) / sum(job_total) for contractor-assigned jobs
  const contractorJobs = allJobs.filter(j => j.assignment_type === 'contractor');
  const contractorJobTotal = contractorJobs.reduce((sum, j) => sum + (j.job_total || 0), 0);
  const contractorPayTotal = contractorJobs.reduce((sum, j) => sum + (j.payment_amount || 0), 0);
  const contractorPct = contractorJobTotal > 0 ? (contractorPayTotal / contractorJobTotal) * 100 : 0;

  // Monthly trend: group contractor jobs by month
  const monthMap = new Map<string, { job_total: number; contractor_pay: number }>();
  for (const job of contractorJobs) {
    if (!job.completed_date) continue;
    const month = job.completed_date.substring(0, 7); // "2026-01"
    const entry = monthMap.get(month) || { job_total: 0, contractor_pay: 0 };
    entry.job_total += job.job_total || 0;
    entry.contractor_pay += job.payment_amount || 0;
    monthMap.set(month, entry);
  }

  const monthlyTrend: APMonthlyTrend[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => {
      const [yr, mo] = month.split('-');
      return {
        month,
        label: `${MONTH_LABELS[parseInt(mo, 10) - 1]} ${yr.slice(2)}`,
        job_total: Math.round(data.job_total * 100) / 100,
        contractor_pay: Math.round(data.contractor_pay * 100) / 100,
        contractor_pct: data.job_total > 0
          ? Math.round((data.contractor_pay / data.job_total) * 1000) / 10
          : 0,
      };
    });

  // Get last sync time
  const { data: lastSync } = await supabase
    .from('ap_sync_log')
    .select('completed_at')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single();

  const stats: APDashboardStats = {
    total_jobs: allJobs.length,
    unassigned_jobs: unassigned,
    contractor_jobs: contractor,
    in_house_jobs: inHouse,
    payments_requested: requested,
    payments_approved: approved,
    payments_paid: paid,
    total_outstanding: totalOutstanding,
    total_paid: totalPaid,
    contractor_pct: Math.round(contractorPct * 10) / 10,
    monthly_trend: monthlyTrend,
    last_sync: lastSync?.completed_at || null,
  };

  return NextResponse.json(stats);
}
