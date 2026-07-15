import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasPEPermission } from '@/lib/pe-utils';

// Per-user board column preferences (order, widths, hidden, freeze).
// GET /api/column-prefs?board=service → { prefs } for the signed-in user (null if none saved).
// PUT /api/column-prefs { board, prefs }  → upsert for the signed-in user.

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPEPermission(session, 'can_view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const board = request.nextUrl.searchParams.get('board') || '';
  if (!board) return NextResponse.json({ error: 'board required' }, { status: 400 });

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('pe_user_column_prefs')
    .select('prefs')
    .eq('user_id', session.user.id)
    .eq('board', board)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prefs: data?.prefs ?? null });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPEPermission(session, 'can_view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const board = typeof body?.board === 'string' ? body.board : '';
  const prefs = body?.prefs;
  if (!board || typeof prefs !== 'object' || prefs === null) {
    return NextResponse.json({ error: 'board and prefs required' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { error } = await supabase
    .from('pe_user_column_prefs')
    .upsert({ user_id: session.user.id, board, prefs, updated_at: new Date().toISOString() }, { onConflict: 'user_id,board' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
