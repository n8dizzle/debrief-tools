import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

/** PATCH /api/job-costs/[id] — upsert hand-keyed Equipment/Material/Labor $ for one install job. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAPPermission(session, 'can_manage_payments')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const num = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v));

  const payload: Record<string, unknown> = { job_id: id, updated_by: session.user.id, updated_at: new Date().toISOString() };
  if ('equipment_amount' in body) payload.equipment_amount = num(body.equipment_amount);
  if ('material_amount' in body) payload.material_amount = num(body.material_amount);
  if ('labor_amount' in body) payload.labor_amount = num(body.labor_amount);

  const supabase = getServerSupabase();
  const { error } = await supabase.from('ap_job_cost_inputs').upsert(payload, { onConflict: 'job_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
