import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

/** PATCH /api/pay-types/[id] — edit a pay type's name, %, flat amount, or default job types. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_contractors')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.percent !== undefined) updates.percent = body.percent === null || body.percent === '' ? null : Number(body.percent);
  if (body.flat_amount !== undefined) updates.flat_amount = body.flat_amount === null || body.flat_amount === '' ? null : Number(body.flat_amount);
  if (body.default_job_types !== undefined) updates.default_job_types = Array.isArray(body.default_job_types) ? body.default_job_types : [];

  const supabase = getServerSupabase();
  const { data, error } = await supabase.from('ap_pay_types').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE /api/pay-types/[id] — remove a pay type (only if no technician uses it). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_contractors')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const supabase = getServerSupabase();

  const { count } = await supabase
    .from('ap_technician_pay_types')
    .select('id', { count: 'exact', head: true })
    .eq('pay_type_id', id);
  if ((count || 0) > 0) {
    return NextResponse.json({ error: `In use by ${count} technician${count === 1 ? '' : 's'} — remove those first.` }, { status: 409 });
  }

  const { error } = await supabase.from('ap_pay_types').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
