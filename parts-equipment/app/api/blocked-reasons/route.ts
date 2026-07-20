import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasPEPermission } from '@/lib/pe-utils';

// Blocked reasons store both `value` (the immutable slug written into
// pe_orders.blocked and referenced in code, e.g. the B/O checkbox writes
// 'backordered') and `label` (the human text managers edit). New reasons derive
// their value from the label once, at creation.
function slugify(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// GET /api/blocked-reasons — full list (incl. inactive), ordered.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasPEPermission(session, 'can_view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('pe_blocked_reasons')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ blockedReasons: data || [] });
}

// POST /api/blocked-reasons — add a reason. Value is derived from the label.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasPEPermission(session, 'can_manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const label = (body.label || '').trim();
  if (!label) {
    return NextResponse.json({ error: 'Label is required' }, { status: 400 });
  }
  const value = slugify(label);
  if (!value) {
    return NextResponse.json({ error: 'Label must contain letters or numbers' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { data: last } = await supabase
    .from('pe_blocked_reasons')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (last?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from('pe_blocked_reasons')
    .insert({ value, label, sort_order: nextOrder })
    .select()
    .single();

  if (error) {
    const status = (error as { code?: string }).code === '23505' ? 409 : 500;
    const message = status === 409 ? `"${label}" already exists` : error.message;
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ blockedReason: data }, { status: 201 });
}

// PUT /api/blocked-reasons — reorder. Body: { ids: number[] } in desired order.
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasPEPermission(session, 'can_manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const ids: number[] = Array.isArray(body.ids) ? body.ids : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase
      .from('pe_blocked_reasons')
      .update({ sort_order: i + 1 })
      .eq('id', ids[i]);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
