import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import type { InstallTech } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type SessionUser = { role?: string; permissions?: Record<string, Record<string, boolean>> | null };
function canView(user: SessionUser | undefined): boolean {
  return !!user && (user.role === 'owner' || !!user.permissions?.hr_hub?.can_access);
}

// GET /api/techs — the install-tech roster, read live from ap_technicians (same
// Supabase project) and merged with each tech's ladder placement (hr_tech_ladder).
// Returns comp data (hourly_rate) so it must be gated, not just authenticated.
export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canView(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = getServerSupabase();

  // Scope to the HVAC Install business unit only. `show_in_install` is set true across
  // most service crews so it can't be trusted here; matching the BU keeps this to the
  // real HVAC install team (the population the ladder is written for).
  const { data: techs, error } = await supabase
    .from('ap_technicians')
    .select('st_technician_id, name, is_active, business_unit_name, team, is_install_lead, show_in_install, hourly_rate')
    .eq('is_active', true)
    .eq('business_unit_name', 'HVAC - Install')
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Drop the "Subs" aggregate placeholder (not an individual technician).
  const installTechs = (techs || []).filter(
    (t: any) => !/sub/i.test(t.team || '') && !/^install team$/i.test((t.name || '').trim())
  );

  // Merge ladder placement.
  const ids = installTechs.map((t) => t.st_technician_id).filter((x) => x != null);
  let ladderById = new Map<number, any>();
  if (ids.length > 0) {
    const { data: ladder } = await supabase
      .from('hr_tech_ladder')
      .select('st_technician_id, current_rung_id, hire_date, notes')
      .in('st_technician_id', ids);
    ladderById = new Map((ladder || []).map((r) => [Number(r.st_technician_id), r]));
  }

  const roster: InstallTech[] = installTechs.map((t) => {
    const l = ladderById.get(Number(t.st_technician_id));
    return {
      st_technician_id: Number(t.st_technician_id),
      name: t.name,
      is_active: t.is_active,
      business_unit_name: t.business_unit_name ?? t.team ?? null,
      is_install_lead: !!t.is_install_lead,
      hourly_rate: t.hourly_rate != null ? Number(t.hourly_rate) : null,
      current_rung_id: l?.current_rung_id ?? null,
      hire_date: l?.hire_date ?? null,
      notes: l?.notes ?? null,
    };
  });

  return NextResponse.json({ techs: roster });
}
