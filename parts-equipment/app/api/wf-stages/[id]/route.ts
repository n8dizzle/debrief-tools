import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasPEPermission } from '@/lib/pe-utils';

// PATCH /api/wf-stages/[id] — edit label / color / flags / active.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPEPermission(session, 'can_manage')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const patch: Record<string, unknown> = {};
  if (typeof body.label === 'string') patch.label = body.label.trim();
  if ('color' in body) patch.color = body.color || null;
  if ('is_terminal' in body) patch.is_terminal = !!body.is_terminal;
  if ('is_parts_active' in body) patch.is_parts_active = !!body.is_parts_active;
  if ('active' in body) patch.active = !!body.active;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });

  const supabase = getServerSupabase();
  const { data, error } = await supabase.from('pe_wf_stages').update(patch).eq('id', params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stage: data });
}

// DELETE /api/wf-stages/[id] — remove a stage (its steps cascade).
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPEPermission(session, 'can_manage')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = getServerSupabase();
  const { error } = await supabase.from('pe_wf_stages').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
