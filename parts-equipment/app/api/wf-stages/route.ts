import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasPEPermission } from '@/lib/pe-utils';

// Workflow-engine stage config (Settings → Workflows). Manager-editable stages that
// drive the boards' columns. Schema-aware (sandbox on the sandbox deployment).
// A stage key is derived from the label (slug); the boards match behavior by key.

function slug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'stage';
}

// GET /api/wf-stages?board=warehouse — one board's stages (or all if no board), ordered.
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPEPermission(session, 'can_view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const board = request.nextUrl.searchParams.get('board');
  const supabase = getServerSupabase();
  let q = supabase.from('pe_wf_stages').select('*').order('sort_order', { ascending: true });
  if (board) q = q.eq('board', board);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stages: data || [] });
}

// POST /api/wf-stages — add a stage to a board (appended to the end).
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPEPermission(session, 'can_manage')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const board = (body.board || '').trim();
  const label = (body.label || '').trim();
  if (!board || !label) return NextResponse.json({ error: 'board and label are required' }, { status: 400 });

  const supabase = getServerSupabase();
  const { data: existing } = await supabase.from('pe_wf_stages').select('key, sort_order').eq('board', board);
  const nextOrder = Math.max(0, ...((existing || []).map(r => r.sort_order || 0))) + 1;
  // ensure a unique key within the board
  let key = slug(label), n = 1;
  const taken = new Set((existing || []).map(r => r.key));
  while (taken.has(key)) key = `${slug(label)}_${++n}`;

  const { data, error } = await supabase.from('pe_wf_stages').insert({
    board, key, label, sort_order: nextOrder,
    color: body.color || null, is_terminal: !!body.is_terminal,
    is_parts_active: body.is_parts_active !== false, active: true,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stage: data });
}

// PUT /api/wf-stages — reorder within a board: { ids: [...] } in the new order.
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPEPermission(session, 'can_manage')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { ids } = await request.json();
  if (!Array.isArray(ids)) return NextResponse.json({ error: 'ids array required' }, { status: 400 });
  const supabase = getServerSupabase();
  for (let i = 0; i < ids.length; i++) {
    await supabase.from('pe_wf_stages').update({ sort_order: i + 1 }).eq('id', ids[i]);
  }
  return NextResponse.json({ ok: true });
}
