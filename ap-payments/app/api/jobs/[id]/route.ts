import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

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

  const { data, error } = await supabase
    .from('ap_install_jobs')
    .select(`
      *,
      contractor:ap_contractors(*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  // Get activity log for this job
  const { data: activities } = await supabase
    .from('ap_activity_log')
    .select(`
      *,
      performer:portal_users!ap_activity_log_performed_by_fkey(name, email)
    `)
    .eq('job_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({ job: data, activities: activities || [] });
}
