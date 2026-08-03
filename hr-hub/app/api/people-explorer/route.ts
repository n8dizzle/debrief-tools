import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type SessionUser = { role?: string; permissions?: Record<string, Record<string, boolean>> | null };
function canView(user: SessionUser | undefined): boolean {
  return !!user && (user.role === 'owner' || !!user.permissions?.hr_hub?.can_access);
}

// GET /api/people-explorer — every people record from every system, RAW.
//
// Deliberately does NO filtering, matching, or de-duplication. The whole point is to
// see exactly what each system holds, including non-human entities, terminated people,
// and duplicate-looking rows.
//
// No compensation anywhere: not selected, not returned. Pay lives in Gusto and stays
// there. Still permission-gated, since the roster itself is not public.
//
//   Gusto (hr_gusto_snapshot) ── HR source of record, 133 rows incl. terminated
//   ServiceTitan (pr_employees) ─ widest ST mirror, employee-id space
//   ServiceTitan (ap_technicians) ─ tech mirror, technician-id space
//   AP contractors (ap_contractors) ─ who AP pays
//   Portal (portal_users) ── app logins
export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canView(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = getServerSupabase();

  const [gusto, stEmployees, stTechs, contractors, portal] = await Promise.all([
    // No compensation fields. Pay is deliberately not stored or served by this app.
    supabase
      .from('hr_gusto_snapshot')
      .select(
        'gusto_uuid, worker_kind, first_name, middle_initial, last_name, preferred_first_name, business_name, ' +
          'email, work_email, phone, department, title, employment_status, ' +
          'terminated, termination_date, hire_date, onboarding_status, employee_code, pulled_at'
      )
      .order('last_name', { nullsFirst: false }),
    supabase
      .from('pr_employees')
      .select('st_employee_id, name, role, trade, business_unit_id, business_unit_name, is_active')
      .order('name'),
    supabase
      .from('ap_technicians')
      .select(
        'st_technician_id, name, trade, business_unit_name, team, is_active, show_in_install, is_install_lead'
      )
      .order('name'),
    supabase
      .from('ap_contractors')
      .select('id, name, contact_name, email, phone, trade, is_active, has_w9, has_coi, has_signed_agreement')
      .order('name'),
    supabase
      .from('portal_users')
      .select('id, name, email, role, is_active, department_id, last_login_at')
      .order('name'),
  ]);

  const firstError =
    gusto.error || stEmployees.error || stTechs.error || contractors.error || portal.error;
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });

  // hr_gusto_snapshot is not in the generated Supabase types yet, so the row shape
  // comes back untyped. Cast once here rather than sprinkling casts downstream.
  const gustoRows = (gusto.data ?? []) as unknown as Array<Record<string, unknown>>;

  return NextResponse.json({
    gusto: gustoRows,
    stEmployees: stEmployees.data ?? [],
    stTechs: stTechs.data ?? [],
    contractors: contractors.data ?? [],
    portal: portal.data ?? [],
    pulledAt: (gustoRows[0]?.pulled_at as string | undefined) ?? null,
  });
}
