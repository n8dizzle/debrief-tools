import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase, APDashboardStats } from '@/lib/supabase';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  // Get job counts by assignment type
  const { data: jobs } = await supabase
    .from('ap_install_jobs')
    .select('assignment_type, payment_status, payment_amount, contractor_id');

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
    last_sync: lastSync?.completed_at || null,
  };

  return NextResponse.json(stats);
}
