import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

/** PATCH /api/technicians/[id]/pay-types/[ptId] — edit a tech's pay arrangement. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; ptId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_contractors')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { ptId } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.hourly_rate !== undefined) updates.hourly_rate = body.hourly_rate === null ? null : Number(body.hourly_rate);
  if (body.percent !== undefined) updates.percent = body.percent === null ? null : Number(body.percent);
  if (body.flat_amount !== undefined) updates.flat_amount = body.flat_amount === null ? null : Number(body.flat_amount);
  if (body.default_job_types !== undefined) updates.default_job_types = Array.isArray(body.default_job_types) ? body.default_job_types : [];

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('ap_technician_pay_types')
    .update(updates)
    .eq('id', ptId)
    .select(`id, technician_id, pay_type_id, hourly_rate, percent, flat_amount, default_job_types,
             pay_type:ap_pay_types(id, name, method)`)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE /api/technicians/[id]/pay-types/[ptId] — remove a tech's pay arrangement. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; ptId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_contractors')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { ptId } = await params;
  const supabase = getServerSupabase();
  const { error } = await supabase.from('ap_technician_pay_types').delete().eq('id', ptId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
