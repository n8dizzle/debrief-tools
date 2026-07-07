import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// Manager-controlled recall root-cause taxonomy (sd_recall_root_causes).
// Owner + manager only (mirrors the /api/settings/weights gate: everyone but 'employee').
// The label is the value stored on investigations, so rename cascades to historical rows.

type RootCauseRow = {
  id: string; label: string; sort_order: number; archived_at: string | null;
  created_at: string; updated_at: string;
};

function canManage(session: { user?: { role?: string } } | null): boolean {
  const role = session?.user?.role;
  return role === 'owner' || role === 'manager';
}

// GET — full taxonomy (active + archived) with a usage count per label.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManage(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = getServerSupabase();
  const { data: causes } = await supabase
    .from('sd_recall_root_causes')
    .select('*')
    .order('archived_at', { ascending: true, nullsFirst: true })
    .order('sort_order', { ascending: true });

  // Usage counts: low-volume table, so fetch stored labels and tally in JS (no GROUP BY dep).
  const { data: invs } = await supabase
    .from('sd_recall_investigations')
    .select('root_cause_category')
    .not('root_cause_category', 'is', null);
  const usage = new Map<string, number>();
  for (const i of (invs || [])) usage.set(i.root_cause_category, (usage.get(i.root_cause_category) || 0) + 1);

  const rows = ((causes || []) as RootCauseRow[]).map(c => ({ ...c, usage_count: usage.get(c.label) || 0 }));
  return NextResponse.json({ causes: rows }, { headers: { 'Cache-Control': 'no-store' } });
}

// POST — create a new active cause. Body: { label }.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManage(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  if (!label) return NextResponse.json({ error: 'A label is required.' }, { status: 400 });

  const supabase = getServerSupabase();
  const actor = (session.user as { id?: string }).id ?? null;

  // Next sort_order = end of the active list.
  const { data: maxRow } = await supabase
    .from('sd_recall_root_causes').select('sort_order').is('archived_at', null)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('sd_recall_root_causes')
    .insert({ label, sort_order: nextOrder, created_by: actor })
    .select().single();
  if (error) {
    // Unique partial index on (label) WHERE archived_at IS NULL → friendly 409 on duplicate.
    if (error.code === '23505') return NextResponse.json({ error: `"${label}" already exists.` }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ cause: data });
}

// PATCH — rename (with cascade), archive, unarchive, or reorder.
// Body: { id, action: 'rename'|'archive'|'unarchive'|'reorder', label?, sort_order? }
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManage(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const { id, action } = body as { id?: string; action?: string };
  if (!id || !action) return NextResponse.json({ error: 'id and action are required.' }, { status: 400 });

  const supabase = getServerSupabase();
  const { data: existing } = await supabase
    .from('sd_recall_root_causes').select('*').eq('id', id).maybeSingle<RootCauseRow>();
  if (!existing) return NextResponse.json({ error: 'Cause not found.' }, { status: 404 });

  const now = new Date().toISOString();

  if (action === 'rename') {
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    if (!label) return NextResponse.json({ error: 'A label is required.' }, { status: 400 });
    if (label === existing.label) return NextResponse.json({ cause: existing, relabeled: 0 });

    // Rename the taxonomy row first (the unique partial index rejects a collision with
    // another ACTIVE label).
    const { error: upErr } = await supabase
      .from('sd_recall_root_causes').update({ label, updated_at: now }).eq('id', id);
    if (upErr) {
      if (upErr.code === '23505') return NextResponse.json({ error: `"${label}" already exists.` }, { status: 409 });
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    // Cascade: relabel historical investigations so Trends stays one bucket. The value is
    // the label string, so a simple equality UPDATE covers both human and AI columns.
    const { data: relabeled } = await supabase
      .from('sd_recall_investigations').update({ root_cause_category: label })
      .eq('root_cause_category', existing.label).select('st_recall_job_id');
    await supabase
      .from('sd_recall_investigations').update({ ai_root_cause_category: label })
      .eq('ai_root_cause_category', existing.label);
    return NextResponse.json({ cause: { ...existing, label }, relabeled: (relabeled || []).length });
  }

  if (action === 'archive') {
    if (existing.archived_at) return NextResponse.json({ cause: existing }); // already archived
    // Invariant: never leave zero active causes (resolve + the AI strict-tool enum need ≥1).
    const { count } = await supabase
      .from('sd_recall_root_causes').select('*', { count: 'exact', head: true }).is('archived_at', null);
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: 'Cannot archive the last active root cause.' }, { status: 400 });
    }
    const { data } = await supabase
      .from('sd_recall_root_causes').update({ archived_at: now, updated_at: now }).eq('id', id).select().single();
    return NextResponse.json({ cause: data });
  }

  if (action === 'unarchive') {
    // Restoring a label that now collides with an active one is rejected by the unique index.
    const { data, error } = await supabase
      .from('sd_recall_root_causes').update({ archived_at: null, updated_at: now }).eq('id', id).select().single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: `"${existing.label}" is already active.` }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ cause: data });
  }

  if (action === 'reorder') {
    const sort_order = Number(body.sort_order);
    if (!Number.isFinite(sort_order)) return NextResponse.json({ error: 'sort_order must be a number.' }, { status: 400 });
    const { data } = await supabase
      .from('sd_recall_root_causes').update({ sort_order, updated_at: now }).eq('id', id).select().single();
    return NextResponse.json({ cause: data });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
