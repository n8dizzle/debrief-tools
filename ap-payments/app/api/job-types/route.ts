import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

/**
 * GET /api/job-types — distinct ServiceTitan job_type_name values seen on synced jobs.
 * Used for the "Default for" multi-select on technician pay types.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('ap_install_jobs')
    .select('job_type_name')
    .not('job_type_name', 'is', null)
    .limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const types = Array.from(new Set((data || []).map((r: any) => r.job_type_name).filter(Boolean))).sort();
  return NextResponse.json(types);
}
