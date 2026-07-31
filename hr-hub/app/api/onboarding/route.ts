import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type SessionUser = { id?: string; role?: string; permissions?: Record<string, Record<string, boolean>> | null };
function canView(u: SessionUser | undefined) { return !!u && (u.role === 'owner' || !!u.permissions?.hr_hub?.can_access); }
function canWrite(u: SessionUser | undefined) {
  const p = u?.permissions?.hr_hub;
  return !!u && (u.role === 'owner' || !!p?.can_create_onboardings || !!p?.can_manage_templates || !!p?.can_complete_any_task);
}

const EMPTY_STATE = { task_state: {}, custom_tasks: {}, skill_state: {}, eval_state: {}, custom_evals: {}, doc_state: {}, form_data: {} };

// GET /api/onboarding — all employees (active + completed) + their state, keyed by id.
export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canView(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = getServerSupabase();
  const [{ data: emps, error: e1 }, { data: states, error: e2 }] = await Promise.all([
    supabase.from('hr_onboarding_employees').select('*').order('created_at'),
    supabase.from('hr_onboarding_state').select('*'),
  ]);
  if (e1 || e2) return NextResponse.json({ error: (e1 || e2)!.message }, { status: 500 });

  const stateById: Record<string, any> = {};
  for (const s of states || []) stateById[s.employee_id] = s;

  return NextResponse.json({ employees: emps || [], state: stateById });
}

// POST /api/onboarding — create a new onboarding file (manual add).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canWrite(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const b = await req.json().catch(() => null);
  if (!b?.name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const supabase = getServerSupabase();
  const { data: emp, error } = await supabase.from('hr_onboarding_employees').insert({
    name: String(b.name),
    title: b.title ?? null,
    dept: b.dept ?? null,
    mgr: b.mgr ?? null,
    start: b.start || null,
    type: b.type ?? null,
    color_idx: Number.isFinite(b.color_idx) ? b.color_idx : 0,
    created_by: user.id ?? null,
  }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('hr_onboarding_state').insert({ employee_id: emp.id, ...EMPTY_STATE });
  return NextResponse.json({ employee: emp });
}
