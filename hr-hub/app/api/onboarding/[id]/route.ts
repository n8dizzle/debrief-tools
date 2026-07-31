import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type SessionUser = { id?: string; role?: string; permissions?: Record<string, Record<string, boolean>> | null };
function canWrite(u: SessionUser | undefined) {
  const p = u?.permissions?.hr_hub;
  return !!u && (u.role === 'owner' || !!p?.can_create_onboardings || !!p?.can_manage_templates || !!p?.can_complete_any_task);
}

const EMP_FIELDS = ['name', 'title', 'dept', 'mgr', 'start', 'type', 'status', 'completed_date', 'color_idx'];
const STATE_FIELDS = ['task_state', 'custom_tasks', 'skill_state', 'eval_state', 'custom_evals', 'doc_state', 'form_data'];

// PATCH /api/onboarding/[id] — update employee fields and/or persist state slices.
// body: { emp?: {name,...}, state?: {task_state,...} }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const b = await req.json().catch(() => null);
  const supabase = getServerSupabase();

  if (b?.emp && typeof b.emp === 'object') {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of EMP_FIELDS) if (k in b.emp) patch[k] = b.emp[k];
    const { error } = await supabase.from('hr_onboarding_employees').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (b?.state && typeof b.state === 'object') {
    const patch: Record<string, unknown> = { employee_id: id, updated_at: new Date().toISOString() };
    for (const k of STATE_FIELDS) if (k in b.state) patch[k] = b.state[k];
    const { error } = await supabase.from('hr_onboarding_state').upsert(patch, { onConflict: 'employee_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
