import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

/**
 * GET /api/technician-pay-types — ALL technician pay configs (joined to pay type), in one call.
 * Lets the Pay setup show each tech's pay-type tags without expanding every row.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_contractors')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('ap_technician_pay_types')
    .select(`id, technician_id, pay_type_id, hourly_rate,
             pay_type:ap_pay_types(id, name, method, percent, flat_amount, default_job_types)`)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
