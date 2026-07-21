import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

// Phase 1 of the configurable workflow engine: serve a board's stage/step template so
// the board renders its columns from config instead of hardcoded values. Schema-aware
// (respects NEXT_PUBLIC_PE_DB_SCHEMA — sandbox on the sandbox deployment). Read-only.
export async function GET(request: Request) {
  const board = new URL(request.url).searchParams.get('board') || '';
  if (!board) return NextResponse.json({ error: 'board required' }, { status: 400 });

  const supabase = getServerSupabase();
  const { data: stages, error } = await supabase
    .from('pe_wf_stages')
    .select('id, board, key, label, sort_order, color, is_terminal, is_parts_active, advances_to')
    .eq('board', board)
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (stages || []).map(s => s.id);
  const { data: steps } = ids.length
    ? await supabase
        .from('pe_wf_steps')
        .select('id, stage_id, key, label, sort_order, data_type, field, options, kind, signal, action_label')
        .in('stage_id', ids)
        .eq('active', true)
        .order('sort_order', { ascending: true })
    : { data: [] as any[] };

  const byStage = new Map<number, any[]>();
  for (const st of steps || []) {
    if (!byStage.has(st.stage_id)) byStage.set(st.stage_id, []);
    byStage.get(st.stage_id)!.push(st);
  }
  const result = (stages || []).map(s => ({ ...s, steps: byStage.get(s.id) || [] }));
  return NextResponse.json({ board, stages: result });
}
