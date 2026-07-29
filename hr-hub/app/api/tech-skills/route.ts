import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { ALL_SKILL_IDS } from '@/lib/ladder';

export const dynamic = 'force-dynamic';

type SessionUser = {
  id?: string;
  role?: string;
  permissions?: Record<string, Record<string, boolean>> | null;
};

function canView(user: SessionUser | undefined): boolean {
  return !!user && (user.role === 'owner' || !!user.permissions?.hr_hub?.can_access);
}
function canEdit(user: SessionUser | undefined): boolean {
  if (!user) return false;
  return user.role === 'owner' || !!user.permissions?.hr_hub?.can_manage_templates;
}

// GET /api/tech-skills            — all checkoff rows (for the team heatmap)
// GET /api/tech-skills?tech=<id>   — checkoff rows for one tech
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canView(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const tech = req.nextUrl.searchParams.get('tech');
  const supabase = getServerSupabase();
  let query = supabase
    .from('hr_tech_skill_status')
    .select('st_technician_id, skill_id, status, note, verified_by, verified_at, updated_at');
  if (tech) query = query.eq('st_technician_id', Number(tech));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ statuses: data || [] });
}

// POST /api/tech-skills — upsert one skill checkoff.
// body: { st_technician_id, skill_id, status, note? }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canEdit(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const st_technician_id = Number(body?.st_technician_id);
  const skill_id = String(body?.skill_id || '');
  const status = String(body?.status || '');
  const note = body?.note != null ? String(body.note) : null;

  if (!st_technician_id || !skill_id) {
    return NextResponse.json({ error: 'Missing st_technician_id or skill_id' }, { status: 400 });
  }
  if (!ALL_SKILL_IDS.has(skill_id)) {
    return NextResponse.json({ error: 'Unknown skill_id' }, { status: 400 });
  }
  if (!['not_started', 'in_progress', 'verified'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const row = {
    st_technician_id,
    skill_id,
    status,
    note,
    verified_by: status === 'verified' ? user.id ?? null : null,
    verified_at: status === 'verified' ? now : null,
    updated_at: now,
  };

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('hr_tech_skill_status')
    .upsert(row, { onConflict: 'st_technician_id,skill_id' })
    .select('st_technician_id, skill_id, status, note, verified_by, verified_at, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: data });
}
