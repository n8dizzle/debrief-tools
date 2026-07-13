import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasPEPermission } from '@/lib/pe-utils';

// GET /api/suppliers — full list (incl. inactive), ordered. Settings needs all
// rows; dropdowns filter to active client-side.
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
    .from('pe_suppliers')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ suppliers: data || [] });
}

// POST /api/suppliers — add a supplier (appended to the end).
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasPEPermission(session, 'can_manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const name = (body.name || '').trim();
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { data: last } = await supabase
    .from('pe_suppliers')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (last?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from('pe_suppliers')
    .insert({ name, sort_order: nextOrder })
    .select()
    .single();

  if (error) {
    // 23505 = unique_violation
    const status = (error as { code?: string }).code === '23505' ? 409 : 500;
    const message = status === 409 ? `"${name}" already exists` : error.message;
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ supplier: data }, { status: 201 });
}

// PUT /api/suppliers — reorder. Body: { ids: number[] } in desired order.
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
      .from('pe_suppliers')
      .update({ sort_order: i + 1 })
      .eq('id', ids[i]);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
