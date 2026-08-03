import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import {
  buildGustoIndex,
  gustoDisplayName,
  gustoNameForms,
  matchToGusto,
  nameDiffersFromGusto,
  nameKey,
  ST_BU_TO_GUSTO_DEPT,
  type GustoPerson,
} from '@/lib/people-match';

export const dynamic = 'force-dynamic';

type SessionUser = { role?: string; permissions?: Record<string, Record<string, boolean>> | null };
function canView(user: SessionUser | undefined): boolean {
  return !!user && (user.role === 'owner' || !!user.permissions?.hr_hub?.can_access);
}

// GET /api/people-align — the punch list for getting other systems aligned to Gusto.
//
// Grouped by WHERE THE FIX LIVES, because that determines what you actually do:
//
//   fixInSt      ServiceTitan holds the field (name, business unit, active, existence)
//
// ServiceTitan stores only id / name / businessUnitId / active per person, so job title,
// department, and hire date CANNOT be pushed into it. Those live in Gusto only.
//
// Compensation is deliberately absent everywhere in this app: not stored, not compared,
// not served. Pay lives in Gusto and stays there.
//
// Nothing here is stored. The list is recomputed on every request from the current Gusto
// snapshot and the live ST mirrors, so an item disappears once the underlying record is
// actually fixed. There is deliberately no "mark as done" — self-reported completion goes
// stale, a recomputed list cannot.
export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canView(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = getServerSupabase();

  const [gustoRes, stEmpRes, stTechRes] = await Promise.all([
    supabase
      .from('hr_gusto_snapshot')
      .select(
        'gusto_uuid, worker_kind, first_name, last_name, preferred_first_name, business_name, ' +
          'email, department, title, terminated, termination_date, hire_date'
      ),
    supabase.from('pr_employees').select('st_employee_id, name, role, business_unit_name, is_active'),
    supabase
      .from('ap_technicians')
      .select('st_technician_id, name, business_unit_name, team, is_active'),
  ]);

  const err = gustoRes.error || stEmpRes.error || stTechRes.error;
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  const gusto = (gustoRes.data ?? []) as unknown as GustoPerson[];
  const stEmp = (stEmpRes.data ?? []) as Array<{
    st_employee_id: number; name: string | null; role: string | null;
    business_unit_name: string | null; is_active: boolean | null;
  }>;
  const stTech = (stTechRes.data ?? []) as Array<{
    st_technician_id: number; name: string | null; business_unit_name: string | null;
    team: string | null; is_active: boolean | null;
  }>;

  const index = buildGustoIndex(gusto);

  // Every name key ServiceTitan knows about, active or not, from both id spaces.
  const stKnownKeys = new Set<string>();
  for (const r of stEmp) stKnownKeys.add(nameKey(r.name));
  for (const r of stTech) stKnownKeys.add(nameKey(r.name));

  const stEmpActive = stEmp.filter((r) => r.is_active);
  const stTechActive = stTech.filter((r) => r.is_active);

  // ── Terminated in Gusto but still active in ServiceTitan (offboarding gap) ──────
  const terminatedStillActive: Array<{
    label: string; stName: string; idSpace: string; stId: number;
    endedOn: string | null; businessUnit: string | null;
  }> = [];
  for (const r of stEmpActive) {
    const m = matchToGusto(r.name, index);
    if (m?.person.terminated) {
      terminatedStillActive.push({
        label: gustoDisplayName(m.person), stName: r.name ?? '', idSpace: 'st_employee',
        stId: r.st_employee_id, endedOn: m.person.termination_date,
        businessUnit: r.business_unit_name,
      });
    }
  }
  for (const r of stTechActive) {
    const m = matchToGusto(r.name, index);
    if (m?.person.terminated) {
      terminatedStillActive.push({
        label: gustoDisplayName(m.person), stName: r.name ?? '', idSpace: 'st_technician',
        stId: r.st_technician_id, endedOn: m.person.termination_date,
        businessUnit: r.business_unit_name,
      });
    }
  }
  terminatedStillActive.sort((a, b) => (a.endedOn || '').localeCompare(b.endedOn || ''));

  // ── Active in Gusto, no ServiceTitan record under any known name ────────────────
  const missingInSt = gusto
    .filter((g) => !g.terminated)
    .filter((g) => !gustoNameForms(g).some((f) => stKnownKeys.has(nameKey(f))))
    .map((g) => ({
      label: gustoDisplayName(g), workerKind: g.worker_kind, title: g.title,
      department: g.department, hiredOn: g.hire_date,
    }))
    .sort((a, b) => (b.hiredOn || '').localeCompare(a.hiredOn || ''));

  // ── Name spelling drift on a person who IS matched and active ──────────────────
  const nameDrift: Array<{ label: string; stName: string; gustoName: string; idSpace: string; how: string }> = [];
  const seenDrift = new Set<string>();
  const collectDrift = (name: string | null, idSpace: string) => {
    const m = matchToGusto(name, index);
    if (!m || m.person.terminated) return;
    if (!nameDiffersFromGusto(name, m.person)) return;
    const dedupe = `${idSpace}|${name}`;
    if (seenDrift.has(dedupe)) return;
    seenDrift.add(dedupe);
    nameDrift.push({
      label: gustoDisplayName(m.person), stName: name ?? '',
      gustoName: gustoNameForms(m.person)[0] ?? '', idSpace, how: m.how,
    });
  };
  for (const r of stEmpActive) collectDrift(r.name, 'st_employee');
  for (const r of stTechActive) collectDrift(r.name, 'st_technician');

  // ── ST business unit disagrees with the Gusto department it maps to ─────────────
  const buDrift: Array<{ label: string; businessUnit: string; gustoDepartment: string }> = [];
  for (const r of stTechActive) {
    const m = matchToGusto(r.name, index);
    if (!m || m.person.terminated || !r.business_unit_name) continue;
    const expected = ST_BU_TO_GUSTO_DEPT[r.business_unit_name];
    if (expected && m.person.department && m.person.department !== expected) {
      buDrift.push({
        label: gustoDisplayName(m.person), businessUnit: r.business_unit_name,
        gustoDepartment: m.person.department,
      });
    }
  }

  // ── Active in ServiceTitan with no Gusto counterpart (people? vendors? queues?) ──
  const notInGusto = stEmpActive
    .filter((r) => !matchToGusto(r.name, index))
    .map((r) => ({
      stName: r.name ?? '', stRole: r.role, businessUnit: r.business_unit_name,
      idSpace: 'st_employee', stId: r.st_employee_id,
    }))
    .sort((a, b) => a.stName.localeCompare(b.stName));

  return NextResponse.json({
    fixInSt: { terminatedStillActive, missingInSt, nameDrift, buDrift, notInGusto },
    // Fields Gusto owns that ServiceTitan has nowhere to store.
    unsyncable: ['job title', 'department', 'hire date', 'worker type'],
    openCount:
      terminatedStillActive.length + missingInSt.length + nameDrift.length + buDrift.length,
  });
}
