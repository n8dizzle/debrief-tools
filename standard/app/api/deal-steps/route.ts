import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { can, type AccessUser } from '@/lib/access';

export const dynamic = 'force-dynamic';

// Toggle a manual sub-step on a deal. Body: { projectId, nodeId, done, note? }.
// Checklist edits need install_tracker.can_edit_workflow.
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as (AccessUser & { id?: string }) | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!can(user, 'can_edit_workflow')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const projectId = Number(body.projectId);
  const nodeId: string = body.nodeId;
  const note: string | null = typeof body.note === 'string' ? body.note : null;
  // Two shapes: a sub-step checkbox ({done}) or a stage gate ({state: required|not_required|null}).
  const hasState = 'state' in body;
  const state: string | null = hasState ? (body.state ?? null) : undefined as unknown as string | null;
  const done: boolean = !!body.done;
  if (!projectId || !nodeId) return NextResponse.json({ error: 'projectId and nodeId required' }, { status: 400 });
  if (hasState && state !== null && state !== 'required' && state !== 'not_required') {
    return NextResponse.json({ error: 'invalid state' }, { status: 400 });
  }

  const row: Record<string, unknown> = {
    st_project_id: projectId,
    node_id: nodeId,
    note,
    updated_at: new Date().toISOString(),
  };
  if (hasState) {
    row.state = state;
    row.done_by = state ? user.id ?? null : null;
    row.done_at = state ? new Date().toISOString() : null;
  } else {
    row.done = done;
    row.done_by = done ? user.id ?? null : null;
    row.done_at = done ? new Date().toISOString() : null;
  }

  const { error } = await supabase.from('install_deal_steps').upsert(row, { onConflict: 'st_project_id,node_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
