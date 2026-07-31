import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type SessionUser = { id?: string; role?: string; permissions?: Record<string, Record<string, boolean>> | null };
function canEdit(user: SessionUser | undefined): boolean {
  return !!user && (user.role === 'owner' || !!user.permissions?.hr_hub?.can_manage_templates);
}

// POST /api/tech-ladder — set a tech's current tier on a ladder (+ record a promotion event).
// body: { st_technician_id, ladder_id, current_tier_id?, hire_date?, notes? }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canEdit(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const st_technician_id = Number(body?.st_technician_id);
  const ladder_id = String(body?.ladder_id || '');
  if (!st_technician_id || !ladder_id) return NextResponse.json({ error: 'Missing st_technician_id or ladder_id' }, { status: 400 });

  const supabase = getServerSupabase();

  let newTier: string | null | undefined;
  if ('current_tier_id' in (body || {})) {
    newTier = body.current_tier_id || null;
    if (newTier) {
      const { data: tier } = await supabase.from('hr_ladder_tiers').select('id').eq('id', newTier).maybeSingle();
      if (!tier) return NextResponse.json({ error: 'Unknown current_tier_id' }, { status: 400 });
    }
  }
  if ('hire_date' in (body || {}) && body.hire_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.hire_date))) {
    return NextResponse.json({ error: 'hire_date must be YYYY-MM-DD' }, { status: 400 });
  }

  // Prior placement (for the promotion-history event).
  const { data: prior } = await supabase
    .from('hr_tech_ladder')
    .select('current_tier_id')
    .eq('st_technician_id', st_technician_id)
    .eq('ladder_id', ladder_id)
    .maybeSingle();
  const priorTier = prior?.current_tier_id ?? null;

  const row: Record<string, unknown> = {
    st_technician_id,
    ladder_id,
    updated_at: new Date().toISOString(),
    updated_by: user.id ?? null,
  };
  if (newTier !== undefined) row.current_tier_id = newTier;
  if ('hire_date' in (body || {})) row.hire_date = body.hire_date || null;
  if ('notes' in (body || {})) row.notes = body.notes ?? null;

  const { data, error } = await supabase
    .from('hr_tech_ladder')
    .upsert(row, { onConflict: 'st_technician_id' })
    .select('st_technician_id, ladder_id, current_tier_id, hire_date, notes')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Record a promotion event when the tier actually changed.
  if (newTier !== undefined && newTier !== priorTier) {
    await supabase.from('hr_tech_ladder_events').insert({
      st_technician_id, ladder_id, from_tier_id: priorTier, to_tier_id: newTier, changed_by: user.id ?? null,
    });
  }

  return NextResponse.json({ ladder: data });
}
