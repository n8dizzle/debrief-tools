import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

/**
 * GET /api/contractor-rates — ALL contractor rate-card rows in one call.
 * Lets the Install Jobs drawer auto-suggest subcontractor pay by matching the job's
 * trade + ServiceTitan job type against each sub's rate card. Read access is fine for
 * anyone who can manage jobs (assigners), not just contractor managers.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_contractors') &&
      !hasAPPermission(session, 'can_manage_assignments') &&
      !hasAPPermission(session, 'can_view_jobs')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('ap_contractor_rates')
    .select('id, contractor_id, trade, job_type_name, rate_amount, rate_type');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
