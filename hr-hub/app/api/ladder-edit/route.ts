import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type SessionUser = { id?: string; role?: string; permissions?: Record<string, Record<string, boolean>> | null };
function canEdit(user: SessionUser | undefined): boolean {
  return !!user && (user.role === 'owner' || !!user.permissions?.hr_hub?.can_manage_templates);
}

// entity → { table, editable fields, required-on-create parent fields }
const ENTITIES: Record<string, { table: string; fields: string[]; parents: string[] }> = {
  ladder: { table: 'hr_ladders', fields: ['name', 'description', 'st_business_units', 'is_active', 'sort_order'], parents: [] },
  level: { table: 'hr_ladder_levels', fields: ['name', 'subtitle', 'gate_note', 'timeframe', 'sort_order'], parents: ['ladder_id'] },
  tier: { table: 'hr_ladder_tiers', fields: ['pay_label', 'pay_value', 'pay_kind', 'gate_note', 'is_default', 'sort_order'], parents: ['level_id'] },
  bucket: { table: 'hr_ladder_buckets', fields: ['name', 'is_gate', 'sort_order'], parents: ['ladder_id'] },
  item: { table: 'hr_ladder_items', fields: ['text', 'is_gate', 'sort_order'], parents: ['tier_id', 'bucket_id'] },
};

function pick(src: any, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in (src || {})) out[k] = src[k];
  return out;
}

// POST /api/ladder-edit — RPC-style mutation for the manager editor.
// body: { entity, op: 'create'|'update'|'delete'|'reorder', ... }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canEdit(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const entity = String(body?.entity || '');
  const op = String(body?.op || '');
  const def = ENTITIES[entity];
  if (!def) return NextResponse.json({ error: 'Unknown entity' }, { status: 400 });

  const supabase = getServerSupabase();

  if (op === 'create') {
    const row: Record<string, unknown> = { ...pick(body, def.fields), ...pick(body, def.parents) };
    for (const p of def.parents) if (row[p] == null) return NextResponse.json({ error: `Missing ${p}` }, { status: 400 });
    if (entity === 'ladder' && row.created_by === undefined) row.created_by = user.id ?? null;
    if (entity === 'ladder' && !row.name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const { data, error } = await supabase.from(def.table).insert(row).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data });
  }

  if (op === 'update') {
    const id = String(body?.id || '');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const patch = pick(body?.patch ?? body, def.fields);
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'No editable fields' }, { status: 400 });
    if (entity === 'ladder') (patch as any).updated_at = new Date().toISOString();
    const { data, error } = await supabase.from(def.table).update(patch).eq('id', id).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ row: data });
  }

  if (op === 'delete') {
    const id = String(body?.id || '');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    // Clean up checkoffs tied to deleted items so no orphans linger.
    if (entity === 'item') {
      await supabase.from('hr_tech_skill_status').delete().eq('item_id', id);
    }
    const { error } = await supabase.from(def.table).delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (op === 'reorder') {
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
    for (let i = 0; i < ids.length; i++) {
      const { error } = await supabase.from(def.table).update({ sort_order: i }).eq('id', ids[i]);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown op' }, { status: 400 });
}
