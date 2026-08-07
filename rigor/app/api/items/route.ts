import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getProcess, getStep } from '@/lib/processes';

// GET  /api/items?process=parts&role=Parts%20Coordinator  -> that role's open items
// PATCH /api/items { id, to, note }                       -> move an item one step
//
// Every move is validated against the process definition and written to rg_events
// with the actor's email. There is no way to change an item's step without leaving
// a trace — that was the thing pe_orders couldn't do.

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const processKey = request.nextUrl.searchParams.get('process') || 'parts';
  const role = request.nextUrl.searchParams.get('role');
  const proc = getProcess(processKey);
  if (!proc) return NextResponse.json({ error: `Unknown process "${processKey}"` }, { status: 400 });

  const supabase = getServerSupabase();
  let q = supabase
    .from('rg_work_items')
    .select('*')
    .eq('process', processKey)
    .is('closed_at', null)
    .order('created_at', { ascending: true });

  if (role) q = q.eq('owner_role', role);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const actor = session.user.email;

  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  const to = typeof body?.to === 'string' ? body.to : '';
  const note = typeof body?.note === 'string' ? body.note : null;
  const patchData = body?.data && typeof body.data === 'object' ? body.data : null;
  const undo = body?.undo === true;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabase = getServerSupabase();
  const { data: item, error: readErr } = await supabase
    .from('rg_work_items').select('*').eq('id', id).single();
  if (readErr || !item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // ── Undo ────────────────────────────────────────────────────────────
  // Send it back where it came from, read from the event log rather than from a
  // reverse edge in the process definition. Two reasons: every step gets undo for
  // free without doubling the moves list, and "back" always means the step this
  // item actually came from, not a step someone guessed it might have come from.
  //
  // This deliberately bypasses the forward-move validation below — the target isn't
  // arbitrary, it's the recorded previous position. The undo is itself an event, so
  // the history shows the mistake and the correction rather than hiding both.
  if (undo) {
    const { data: last } = await supabase
      .from('rg_events')
      .select('*')
      .eq('work_item_id', id)
      .in('kind', ['step', 'close'])
      .order('at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!last?.from_value) {
      return NextResponse.json({ error: 'Nothing to undo — this item has not been moved.' }, { status: 400 });
    }
    const back = getStep(item.process, last.from_value);
    if (!back) return NextResponse.json({ error: `Previous step "${last.from_value}" no longer exists.` }, { status: 400 });

    const { error: undoErr } = await supabase.from('rg_work_items').update({
      step: back.key,
      owner_role: back.role,
      closed_at: null,          // undoing a close reopens it
      closed_reason: null,
    }).eq('id', id);
    if (undoErr) return NextResponse.json({ error: undoErr.message }, { status: 500 });

    await supabase.from('rg_events').insert({
      work_item_id: id, actor, kind: 'undo',
      from_value: item.step, to_value: back.key,
      note: `undo of ${last.kind} at ${last.at}`,
    });
    return NextResponse.json({ ok: true, back: back.key });
  }

  // Field edit only (supplier, order number, eta) — no step change.
  if (!to && patchData) {
    const merged = { ...(item.data || {}), ...patchData };
    const { error } = await supabase.from('rg_work_items').update({ data: merged }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.from('rg_events').insert({
      work_item_id: id, actor, kind: 'edit',
      note: Object.keys(patchData).join(', '),
    });
    return NextResponse.json({ ok: true });
  }

  const current = getStep(item.process, item.step);
  const target = getStep(item.process, to);
  if (!target) return NextResponse.json({ error: `Unknown step "${to}"` }, { status: 400 });
  if (!current?.moves.some(m => m.to === to)) {
    return NextResponse.json(
      { error: `"${item.step}" cannot move to "${to}" in process "${item.process}"` },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = {
    step: to,
    owner_role: target.role,
    data: patchData ? { ...(item.data || {}), ...patchData } : item.data,
  };
  // 'not_needed' is the only human dismissal. It closes the item and records why.
  if (to === 'not_needed') {
    update.closed_at = new Date().toISOString();
    update.closed_reason = note || 'not a part';
  }

  const { error } = await supabase.from('rg_work_items').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('rg_events').insert({
    work_item_id: id, actor, kind: to === 'not_needed' ? 'close' : 'step',
    from_value: item.step, to_value: to, note,
  });

  return NextResponse.json({ ok: true });
}
