import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

/** GET /api/pay-runs/[id] — the jobs covered by one lump payment. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_payments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const supabase = getServerSupabase();

  const { data: run } = await supabase.from('ap_contractor_payments').select('*').eq('id', id).single();
  if (!run) return NextResponse.json({ error: 'Pay run not found' }, { status: 404 });

  const { data: jobs } = await supabase
    .from('ap_install_jobs')
    .select('id, st_job_id, job_number, customer_name, completed_date, payment_amount')
    .eq('payment_batch_id', id)
    .order('completed_date', { ascending: true, nullsFirst: false });

  return NextResponse.json({
    run,
    jobs: (jobs || []).map((j: any) => ({ ...j, payment_amount: j.payment_amount != null ? Number(j.payment_amount) : 0 })),
  });
}
