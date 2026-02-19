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
  const trade = searchParams.get('trade');

  const supabase = getServerSupabase();

  // Get job counts by assignment type
  let query = supabase
    .from('ap_install_jobs')
    .select('assignment_type, payment_status, payment_amount, contractor_id, job_total, completed_date, scheduled_date, trade')
    .eq('is_ignored', false);

  if (trade === 'hvac' || trade === 'plumbing') {
    query = query.eq('trade', trade);
  }

  // Date filter: use completed_date for completed jobs, scheduled_date for non-completed
  if (start) {
    query = query.or(`completed_date.gte.${start},and(completed_date.is.null,scheduled_date.gte.${start}),and(completed_date.is.null,scheduled_date.is.null)`);
  }
  if (end) {
    query = query.or(`completed_date.lte.${end},and(completed_date.is.null,scheduled_date.lte.${end}),and(completed_date.is.null,scheduled_date.is.null)`);
  }

  const { data: jobs } = await query;

  const allJobs = jobs || [];

  const unassigned = allJobs.filter(j => j.assignment_type === 'unassigned').length;
  const contractor = allJobs.filter(j => j.assignment_type === 'contractor').length;
  const inHouse = allJobs.filter(j => j.assignment_type === 'in_house').length;

  const received = allJobs.filter(j => j.payment_status === 'received').length;
  const pendingApproval = allJobs.filter(j => j.payment_status === 'pending_approval').length;
  const readyToPay = allJobs.filter(j => j.payment_status === 'ready_to_pay').length;
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

  // Contractor usage % = contractor / (contractor + in_house)
  const assigned = contractor + inHouse;
  const contractorUsagePct = assigned > 0 ? (contractor / assigned) * 100 : 0;

  // Monthly trend: group all jobs by month for usage stats, contractor jobs for cost stats
  const monthMap = new Map<string, { job_total: number; contractor_pay: number; contractor_count: number; in_house_count: number }>();
  for (const job of allJobs) {
    if (!job.completed_date) continue;
    const month = job.completed_date.substring(0, 7); // "2026-01"
    const entry = monthMap.get(month) || { job_total: 0, contractor_pay: 0, contractor_count: 0, in_house_count: 0 };
    if (job.assignment_type === 'contractor') {
      entry.job_total += job.job_total || 0;
      entry.contractor_pay += job.payment_amount || 0;
      entry.contractor_count++;
    } else if (job.assignment_type === 'in_house') {
      entry.in_house_count++;
    }
    monthMap.set(month, entry);
  }

  const monthlyTrend: APMonthlyTrend[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => {
      const [yr, mo] = month.split('-');
      const monthAssigned = data.contractor_count + data.in_house_count;
      return {
        month,
        label: `${MONTH_LABELS[parseInt(mo, 10) - 1]} ${yr.slice(2)}`,
        job_total: Math.round(data.job_total * 100) / 100,
        contractor_pay: Math.round(data.contractor_pay * 100) / 100,
        contractor_pct: data.job_total > 0
          ? Math.round((data.contractor_pay / data.job_total) * 1000) / 10
          : 0,
        contractor_usage_pct: monthAssigned > 0
          ? Math.round((data.contractor_count / monthAssigned) * 1000) / 10
          : 0,
        contractor_count: data.contractor_count,
        in_house_count: data.in_house_count,
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
    payments_received: received,
    payments_pending_approval: pendingApproval,
    payments_ready_to_pay: readyToPay,
    payments_paid: paid,
    total_outstanding: totalOutstanding,
    total_paid: totalPaid,
    contractor_pct: Math.round(contractorPct * 10) / 10,
    contractor_usage_pct: Math.round(contractorUsagePct * 10) / 10,
    monthly_trend: monthlyTrend,
    last_sync: lastSync?.completed_at || null,
  };

  return NextResponse.json(stats);
}
