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

// PATCH — rename a node. Body: { id, action: 'rename', title }
export async function PATCH(request: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  const { supabase } = g;

  const body = await request.json().catch(() => ({}));
  const { id, action } = body as { id?: string; action?: string };
  if (!id || !action) return NextResponse.json({ error: 'id and action are required.' }, { status: 400 });

  if (action === 'rename') {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return NextResponse.json({ error: 'A title is required.' }, { status: 400 });
    const { data, error } = await supabase
      .from('install_nodes')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Node not found.' }, { status: 404 });
    return NextResponse.json({ node: data });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
