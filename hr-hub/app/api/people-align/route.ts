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

  const [gustoRes, stEmpRes, stTechRes, dispRes] = await Promise.all([
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
    supabase
      .from('hr_people_dispositions')
      .select('system, external_id, external_name, disposition, note'),
  ]);

  const err = gustoRes.error || stEmpRes.error || stTechRes.error || dispRes.error;
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

  // Records the company has classified as "not a person we manage". Keyed
  // system|external_id so a technician and an employee id never collide.
  type Disp = { system: string; external_id: string; external_name: string | null; disposition: string; note: string | null };
  const dispositions = (dispRes.data ?? []) as unknown as Disp[];
  const dispByKey = new Map(dispositions.map((d) => [`${d.system}|${d.external_id}`, d]));
  const isDispositioned = (system: string, id: number | string) => dispByKey.has(`${system}|${id}`);

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
    .filter((r) => !isDispositioned('st_employee', r.st_employee_id))
    .map((r) => ({
      stName: r.name ?? '', stRole: r.role, businessUnit: r.business_unit_name,
      idSpace: 'st_employee', stId: r.st_employee_id,
    }))
    .sort((a, b) => a.stName.localeCompare(b.stName));

  // Already classified as something we do not manage. Shown so a wrong call can be undone.
  const notAConcern = dispositions
    .map((d) => ({
      stName: d.external_name ?? '(name not recorded)', idSpace: d.system,
      stId: d.external_id, disposition: d.disposition, note: d.note,
    }))
    .sort((a, b) => a.stName.localeCompare(b.stName));

  // ── Side by side: every Gusto person with whatever ServiceTitan holds for them ────
  //
  // Gusto owns title and department; ServiceTitan has no field for either, so those
  // cells are marked 'none' rather than 'differs' — an empty shelf is not a mismatch.
  // Comparable fields are name, business unit vs department, and active status.
  const stEmpByKey = new Map<string, typeof stEmp>();
  const stTechByKey = new Map<string, typeof stTech>();
  for (const r of stEmp) {
    const k = nameKey(r.name);
    stEmpByKey.set(k, [...(stEmpByKey.get(k) ?? []), r]);
  }
  for (const r of stTech) {
    const k = nameKey(r.name);
    stTechByKey.set(k, [...(stTechByKey.get(k) ?? []), r]);
  }

  const pairs = gusto
    .map((g) => {
      const keys = gustoNameForms(g).map(nameKey);
      const emps = keys.flatMap((k) => stEmpByKey.get(k) ?? []);
      const techs = keys.flatMap((k) => stTechByKey.get(k) ?? []);
      const stNames = [...new Set([...emps, ...techs].map((r) => r.name ?? ''))].filter(Boolean);
      const stBus = [...new Set([...emps, ...techs].map((r) => r.business_unit_name).filter(Boolean))] as string[];
      const stAnyActive = [...emps, ...techs].some((r) => r.is_active);
      const present = emps.length + techs.length > 0;

      const expectedDept = stBus.map((b) => ST_BU_TO_GUSTO_DEPT[b]).filter(Boolean);

      return {
        gustoUuid: g.gusto_uuid,
        label: gustoDisplayName(g),
        workerKind: g.worker_kind,
        gusto: {
          name: gustoNameForms(g)[0] ?? '',
          preferred: g.preferred_first_name && g.last_name ? `${g.preferred_first_name} ${g.last_name}` : null,
          department: g.department,
          title: g.title,
          status: g.terminated ? 'terminated' : 'active',
          endedOn: g.termination_date,
        },
        st: {
          present,
          names: stNames,
          businessUnits: stBus,
          status: present ? (stAnyActive ? 'active' : 'inactive') : null,
          employeeIds: emps.map((r) => r.st_employee_id),
          technicianIds: techs.map((r) => r.st_technician_id),
        },
        verdict: {
          name: !present ? 'none' : stNames.some((n) => !nameDiffersFromGusto(n, g)) ? 'match' : 'differs',
          department: !present ? 'none'
            : stBus.length === 0 ? 'none'
            : expectedDept.length === 0 ? 'unmapped'
            : expectedDept.includes(g.department ?? '') ? 'match' : 'differs',
          status: !present ? 'none'
            : (g.terminated ? !stAnyActive : stAnyActive) ? 'match' : 'differs',
          title: 'gusto_only',
        },
      };
    })
    .sort((a, b) => {
      // Anything that disagrees floats to the top; terminated people sink.
      const bad = (x: typeof a) => Object.values(x.verdict).filter((v) => v === 'differs').length;
      if (bad(b) !== bad(a)) return bad(b) - bad(a);
      if ((a.gusto.status === 'terminated') !== (b.gusto.status === 'terminated')) {
        return a.gusto.status === 'terminated' ? 1 : -1;
      }
      return a.label.localeCompare(b.label);
    });

  return NextResponse.json({
    fixInSt: { terminatedStillActive, missingInSt, nameDrift, buDrift, notInGusto },
    notAConcern,
    pairs,
    // Fields Gusto owns that ServiceTitan has nowhere to store.
    unsyncable: ['job title', 'department', 'hire date', 'worker type'],
    openCount:
      terminatedStillActive.length + missingInSt.length + nameDrift.length + buDrift.length,
  });
}
