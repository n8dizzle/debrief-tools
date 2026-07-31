import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import type { InstallTech } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type SessionUser = { role?: string; permissions?: Record<string, Record<string, boolean>> | null };
function canView(user: SessionUser | undefined): boolean {
  return !!user && (user.role === 'owner' || !!user.permissions?.hr_hub?.can_access);
}

// GET /api/techs?ladder=<id> — the roster for a ladder, read live from ap_technicians
// (business units defined on the ladder) and merged with each tech's placement on it.
// Returns comp data (hourly_rate) so it must be gated, not just authenticated.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canView(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const ladderId = req.nextUrl.searchParams.get('ladder');
  if (!ladderId) return NextResponse.json({ error: 'Missing ladder param' }, { status: 400 });

  const supabase = getServerSupabase();

  const { data: ladder, error: le } = await supabase
    .from('hr_ladders').select('id, st_business_units').eq('id', ladderId).single();
  if (le) return NextResponse.json({ error: le.message }, { status: le.code === 'PGRST116' ? 404 : 500 });
  const bus: string[] = ladder.st_business_units || [];
  if (bus.length === 0) return NextResponse.json({ techs: [] });

  const { data: techs, error } = await supabase
    .from('ap_technicians')
    .select('st_technician_id, name, is_active, business_unit_name, team, is_install_lead, hourly_rate')
    .eq('is_active', true)
    .in('business_unit_name', bus)
    .order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Drop "Subs" aggregate placeholders (not individual technicians).
  const roster = (techs || []).filter(
    (t: any) => !/sub/i.test(t.team || '') && !/^install team$/i.test((t.name || '').trim())
  );

  const ids = roster.map((t) => t.st_technician_id).filter((x) => x != null);
  let placementById = new Map<number, any>();
  if (ids.length > 0) {
    const { data: placements } = await supabase
      .from('hr_tech_ladder')
      .select('st_technician_id, current_tier_id, hire_date, notes')
      .eq('ladder_id', ladderId)
      .in('st_technician_id', ids);
    placementById = new Map((placements || []).map((r) => [Number(r.st_technician_id), r]));
  }

  const out: InstallTech[] = roster.map((t) => {
    const p = placementById.get(Number(t.st_technician_id));
    return {
      st_technician_id: Number(t.st_technician_id),
      name: t.name,
      is_active: t.is_active,
      business_unit_name: t.business_unit_name ?? t.team ?? null,
      is_install_lead: !!t.is_install_lead,
      hourly_rate: t.hourly_rate != null ? Number(t.hourly_rate) : null,
      current_tier_id: p?.current_tier_id ?? null,
      hire_date: p?.hire_date ?? null,
      notes: p?.notes ?? null,
    };
  });

  return NextResponse.json({ techs: out });
}
