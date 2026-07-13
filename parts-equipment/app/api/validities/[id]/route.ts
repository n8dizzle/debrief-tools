import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasPEPermission } from '@/lib/pe-utils';

// PATCH /api/validities/[id] — rename and/or toggle active.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasPEPermission(session, 'can_manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = Number((await params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = await request.json();
  const changes: { name?: string; active?: boolean } = {};
  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    changes.name = name;
  }
  if (typeof body.active === 'boolean') {
    changes.active = body.active;
  }
  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('pe_validities')
    .update(changes)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    const status = (error as { code?: string }).code === '23505' ? 409 : 500;
    const message = status === 409 ? `"${changes.name}" already exists` : error.message;
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ validity: data });
}

// DELETE /api/validities/[id] — remove an option. Existing orders keep their
// stored value string, so this is safe.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasPEPermission(session, 'can_manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = Number((await params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { error } = await supabase.from('pe_validities').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
