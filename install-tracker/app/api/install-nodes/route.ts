import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// Manager/owner-editable install map (install_nodes). Mirrors the gating of
// service-dashboard's /api/settings/root-causes: everyone but 'employee'.
// Rung 3 supports create (POST) and rename (PATCH action:'rename').
// Reorder / archive land in Rung 4.

const MAX_DEPTH = 1; // 0 = stage, 1 = sub-step (cap at sub-steps for now)

function canManage(session: { user?: { role?: string } } | null): boolean {
  const role = session?.user?.role;
  return role === 'owner' || role === 'manager';
}

async function guard() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!canManage(session)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  const supabase = getServerSupabase();
  if (!supabase) return { error: NextResponse.json({ error: 'Database unavailable' }, { status: 503 }) };
  return { supabase };
}

// POST — create a node. Body: { title, parent_id?: string|null }
// parent_id null → new top-level stage. Otherwise a sub-step under that parent.
export async function POST(request: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  const { supabase } = g;

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const parentId: string | null = body.parent_id ?? null;
  if (!title) return NextResponse.json({ error: 'A title is required.' }, { status: 400 });

  // Derive depth from the parent (guard against exceeding the cap).
  let depth = 0;
  if (parentId) {
    const { data: parent } = await supabase
      .from('install_nodes').select('depth').eq('id', parentId).maybeSingle<{ depth: number }>();
    if (!parent) return NextResponse.json({ error: 'Parent not found.' }, { status: 404 });
    depth = parent.depth + 1;
    if (depth > MAX_DEPTH) {
      return NextResponse.json({ error: 'Maximum nesting depth reached.' }, { status: 400 });
    }
  }

  // Next sort_order = end of the sibling list (same parent, not archived).
  let q = supabase.from('install_nodes').select('sort_order').eq('is_archived', false)
    .order('sort_order', { ascending: false }).limit(1);
  q = parentId ? q.eq('parent_id', parentId) : q.is('parent_id', null);
  const { data: maxRow } = await q.maybeSingle<{ sort_order: number }>();
  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('install_nodes')
    .insert({ title, parent_id: parentId, depth, sort_order: nextOrder })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ node: data });
}

type Node = { id: string; parent_id: string | null; depth: number; sort_order: number; title: string; is_archived: boolean };

// Sibling filter: same parent (null-aware), active only.
function siblingQuery(supabase: NonNullable<ReturnType<typeof getServerSupabase>>, parentId: string | null) {
  const base = supabase.from('install_nodes').select('id, sort_order').eq('is_archived', false);
  return parentId ? base.eq('parent_id', parentId) : base.is('parent_id', null);
}

// PATCH — rename | move | archive | unarchive. Body: { id, action, ... }
export async function PATCH(request: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  const { supabase } = g;
  const now = new Date().toISOString();

  const body = await request.json().catch(() => ({}));
  const { id, action } = body as { id?: string; action?: string };
  if (!id || !action) return NextResponse.json({ error: 'id and action are required.' }, { status: 400 });

  const { data: node } = await supabase
    .from('install_nodes').select('*').eq('id', id).maybeSingle<Node>();
  if (!node) return NextResponse.json({ error: 'Node not found.' }, { status: 404 });

  if (action === 'rename') {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return NextResponse.json({ error: 'A title is required.' }, { status: 400 });
    const { data, error } = await supabase
      .from('install_nodes').update({ title, updated_at: now }).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ node: data });
  }

  if (action === 'move') {
    const dir = body.direction === 'up' ? 'up' : body.direction === 'down' ? 'down' : null;
    if (!dir) return NextResponse.json({ error: "direction must be 'up' or 'down'." }, { status: 400 });
    // Find the adjacent active sibling in the move direction.
    const { data: sibs } = await siblingQuery(supabase, node.parent_id)
      .order('sort_order', { ascending: true });
    const list = (sibs || []) as { id: string; sort_order: number }[];
    const idx = list.findIndex((s) => s.id === id);
    const swapWith = dir === 'up' ? list[idx - 1] : list[idx + 1];
    if (!swapWith) return NextResponse.json({ node, moved: false }); // already at the edge
    // Swap sort_order values.
    await supabase.from('install_nodes').update({ sort_order: swapWith.sort_order, updated_at: now }).eq('id', id);
    await supabase.from('install_nodes').update({ sort_order: node.sort_order, updated_at: now }).eq('id', swapWith.id);
    return NextResponse.json({ moved: true });
  }

  if (action === 'archive') {
    // Soft-delete this node and cascade-archive its children (sub-steps).
    await supabase.from('install_nodes').update({ is_archived: true, updated_at: now }).eq('id', id);
    await supabase.from('install_nodes').update({ is_archived: true, updated_at: now }).eq('parent_id', id);
    return NextResponse.json({ archived: true });
  }

  if (action === 'edit') {
    // Update whitelisted content fields. Body: { id, action:'edit', fields:{...} }
    const ALLOWED = ['summary', 'owner', 'tools', 'typical_duration', 'what_goes_wrong', 'notes'];
    const fields = (body.fields && typeof body.fields === 'object') ? body.fields as Record<string, unknown> : {};
    const update: Record<string, unknown> = {};
    for (const k of Object.keys(fields)) {
      if (!ALLOWED.includes(k)) continue;
      const v = fields[k];
      update[k] = typeof v === 'string' ? (v.trim() || null) : null; // empty string clears the field
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No editable fields provided.' }, { status: 400 });
    }
    update.updated_at = now;
    const { data, error } = await supabase
      .from('install_nodes').update(update).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ node: data });
  }

  if (action === 'unarchive') {
    const { data, error } = await supabase
      .from('install_nodes').update({ is_archived: false, updated_at: now }).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ node: data });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
