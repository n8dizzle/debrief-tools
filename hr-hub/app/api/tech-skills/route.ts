import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type SessionUser = { id?: string; role?: string; permissions?: Record<string, Record<string, boolean>> | null };
function canView(user: SessionUser | undefined): boolean {
  return !!user && (user.role === 'owner' || !!user.permissions?.hr_hub?.can_access);
}
function canEdit(user: SessionUser | undefined): boolean {
  return !!user && (user.role === 'owner' || !!user.permissions?.hr_hub?.can_manage_templates);
}

// GET /api/tech-skills?ladder=<id>       — all checkoff rows for a ladder (team heatmap)
// GET /api/tech-skills?tech=<st_id>      — checkoff rows for one tech
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canView(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = getServerSupabase();
  const tech = req.nextUrl.searchParams.get('tech');
  const ladder = req.nextUrl.searchParams.get('ladder');

  let query = supabase
    .from('hr_tech_skill_status')
    .select('st_technician_id, item_id, status, note, verified_by, verified_at, updated_at')
    .not('item_id', 'is', null);

  if (tech) {
    query = query.eq('st_technician_id', Number(tech));
  } else if (ladder) {
    // Scope to items belonging to this ladder.
    const itemIds = await ladderItemIds(supabase, ladder);
    if (itemIds.length === 0) return NextResponse.json({ statuses: [] });
    query = query.in('item_id', itemIds);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ statuses: data || [] });
}

// POST /api/tech-skills — upsert one checkoff. body: { st_technician_id, item_id, status, note? }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canEdit(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const st_technician_id = Number(body?.st_technician_id);
  const item_id = String(body?.item_id || '');
  const status = String(body?.status || '');
  const note = body?.note != null ? String(body.note) : null;

  if (!st_technician_id || !item_id) return NextResponse.json({ error: 'Missing st_technician_id or item_id' }, { status: 400 });
  if (!['not_started', 'in_progress', 'verified'].includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

  const supabase = getServerSupabase();
  const { data: item } = await supabase.from('hr_ladder_items').select('id').eq('id', item_id).maybeSingle();
  if (!item) return NextResponse.json({ error: 'Unknown item_id' }, { status: 400 });

  const now = new Date().toISOString();
  const row = {
    st_technician_id,
    item_id,
    status,
    note,
    verified_by: status === 'verified' ? user.id ?? null : null,
    verified_at: status === 'verified' ? now : null,
    updated_at: now,
  };
  const { data, error } = await supabase
    .from('hr_tech_skill_status')
    .upsert(row, { onConflict: 'st_technician_id,item_id' })
    .select('st_technician_id, item_id, status, note, verified_by, verified_at, updated_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: data });
}

async function ladderItemIds(supabase: ReturnType<typeof getServerSupabase>, ladderId: string): Promise<string[]> {
  const { data: levels } = await supabase.from('hr_ladder_levels').select('id').eq('ladder_id', ladderId);
  const levelIds = (levels || []).map((l) => l.id);
  if (levelIds.length === 0) return [];
  const { data: tiers } = await supabase.from('hr_ladder_tiers').select('id').in('level_id', levelIds);
  const tierIds = (tiers || []).map((t) => t.id);
  if (tierIds.length === 0) return [];
  const { data: items } = await supabase.from('hr_ladder_items').select('id').in('tier_id', tierIds);
  return (items || []).map((i) => i.id);
}
