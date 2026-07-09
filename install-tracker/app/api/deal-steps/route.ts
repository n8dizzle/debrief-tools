import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Toggle a manual sub-step on a deal. Body: { projectId, nodeId, done, note? }
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'owner' && user.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const projectId = Number(body.projectId);
  const nodeId: string = body.nodeId;
  const done: boolean = !!body.done;
  const note: string | null = typeof body.note === 'string' ? body.note : null;
  if (!projectId || !nodeId) return NextResponse.json({ error: 'projectId and nodeId required' }, { status: 400 });

  const { error } = await supabase.from('install_deal_steps').upsert({
    st_project_id: projectId,
    node_id: nodeId,
    done,
    note,
    done_by: done ? user.id ?? null : null,
    done_at: done ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'st_project_id,node_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, done });
}
