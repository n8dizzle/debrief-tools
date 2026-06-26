import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

const METHODS = ['percent', 'hourly', 'combo', 'flat'];

/** GET /api/pay-types — list pay type structures. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_contractors')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from('ap_pay_types').select('*').order('sort_order');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

/** POST /api/pay-types — add a pay type. Body: { name, method }. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_contractors')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { name, method, percent, flat_amount, default_job_types } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (!METHODS.includes(method)) return NextResponse.json({ error: `method must be one of ${METHODS.join(', ')}` }, { status: 400 });

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('ap_pay_types')
    .insert({
      name: name.trim(),
      method,
      percent: percent != null ? Number(percent) : null,
      flat_amount: flat_amount != null ? Number(flat_amount) : null,
      default_job_types: Array.isArray(default_job_types) ? default_job_types : [],
      sort_order: 99,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
