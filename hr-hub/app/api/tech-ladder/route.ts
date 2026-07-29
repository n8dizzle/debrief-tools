import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { isValidRungId } from '@/lib/ladder';

export const dynamic = 'force-dynamic';

type SessionUser = {
  id?: string;
  role?: string;
  permissions?: Record<string, Record<string, boolean>> | null;
};

function canEdit(user: SessionUser | undefined): boolean {
  if (!user) return false;
  return user.role === 'owner' || !!user.permissions?.hr_hub?.can_manage_templates;
}

// POST /api/tech-ladder — set a tech's current rung / hire date / notes.
// body: { st_technician_id, current_rung_id?, hire_date?, notes? }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canEdit(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const st_technician_id = Number(body?.st_technician_id);
  if (!st_technician_id) return NextResponse.json({ error: 'Missing st_technician_id' }, { status: 400 });

  const row: Record<string, unknown> = {
    st_technician_id,
    updated_at: new Date().toISOString(),
    updated_by: user.id ?? null,
  };
  if ('current_rung_id' in (body || {})) {
    const rung = body.current_rung_id || null;
    if (rung !== null && !isValidRungId(rung)) {
      return NextResponse.json({ error: 'Unknown current_rung_id' }, { status: 400 });
    }
    row.current_rung_id = rung;
  }
  if ('hire_date' in (body || {})) {
    const hd = body.hire_date || null;
    if (hd !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(hd))) {
      return NextResponse.json({ error: 'hire_date must be YYYY-MM-DD' }, { status: 400 });
    }
    row.hire_date = hd;
  }
  if ('notes' in (body || {})) row.notes = body.notes ?? null;

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('hr_tech_ladder')
    .upsert(row, { onConflict: 'st_technician_id' })
    .select('st_technician_id, current_rung_id, hire_date, notes')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ladder: data });
}
