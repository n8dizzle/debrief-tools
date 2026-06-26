import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

/** GET /api/technicians/[id]/pay-types — a technician's configured pay arrangements. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_contractors')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('ap_technician_pay_types')
    .select(`id, technician_id, pay_type_id, hourly_rate, percent, flat_amount, default_job_types,
             pay_type:ap_pay_types(id, name, method)`)
    .eq('technician_id', id)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

/** POST /api/technicians/[id]/pay-types — attach a pay type with this tech's numbers. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_contractors')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json();
  const { pay_type_id, hourly_rate, percent, flat_amount, default_job_types } = body;
  if (!pay_type_id) return NextResponse.json({ error: 'pay_type_id required' }, { status: 400 });

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('ap_technician_pay_types')
    .insert({
      technician_id: id,
      pay_type_id,
      hourly_rate: hourly_rate != null ? Number(hourly_rate) : null,
      percent: percent != null ? Number(percent) : null,
      flat_amount: flat_amount != null ? Number(flat_amount) : null,
      default_job_types: Array.isArray(default_job_types) ? default_job_types : [],
    })
    .select(`id, technician_id, pay_type_id, hourly_rate, percent, flat_amount, default_job_types,
             pay_type:ap_pay_types(id, name, method)`)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
