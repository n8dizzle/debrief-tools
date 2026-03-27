import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// GET /api/nominations/periods/[periodId] - Get period with nominations
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> }
) {
  const { periodId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  const { data: period, error } = await supabase
    .from('cel_nomination_periods')
    .select('*')
    .eq('id', periodId)
    .single();

  if (error || !period) {
    return NextResponse.json({ error: 'Period not found' }, { status: 404 });
  }

  const role = session.user.role;
  const isManager = role === 'owner' || role === 'manager';

  // Managers see all nominations; employees see only their own
  let query = supabase
    .from('cel_nominations')
    .select('*')
    .eq('period_id', periodId)
    .order('created_at', { ascending: false });

  if (!isManager) {
    query = query.eq('nominator_user_id', session.user.id);
  }

  const { data: nominations, error: nomError } = await query;

  if (nomError) {
    return NextResponse.json({ error: nomError.message }, { status: 500 });
  }

  return NextResponse.json({
    period: { ...period, nomination_count: nominations?.length ?? 0 },
    nominations: nominations || [],
  });
}

// PATCH /api/nominations/periods/[periodId] - Update period
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> }
) {
  const { periodId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };

  if (body.title !== undefined) updates.title = body.title.trim();
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.status !== undefined) {
    const validStatuses = ['draft', 'open', 'closed'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    updates.status = body.status;
  }
  if (body.opens_at !== undefined) updates.opens_at = body.opens_at || null;
  if (body.closes_at !== undefined) updates.closes_at = body.closes_at || null;
  if (body.categories !== undefined && Array.isArray(body.categories)) updates.categories = body.categories;
  if (body.winners !== undefined && typeof body.winners === 'object') updates.winners = body.winners;
  if (body.period_type !== undefined) updates.period_type = body.period_type;
  if (body.year !== undefined) updates.year = body.year || null;
  if (body.quarter !== undefined) updates.quarter = body.quarter || null;

  const supabase = getServerSupabase();

  const { data: period, error } = await supabase
    .from('cel_nomination_periods')
    .update(updates)
    .eq('id', periodId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ period });
}

// DELETE /api/nominations/periods/[periodId] - Delete period
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> }
) {
  const { periodId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can delete periods' }, { status: 403 });
  }

  const supabase = getServerSupabase();

  const { error } = await supabase
    .from('cel_nomination_periods')
    .delete()
    .eq('id', periodId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
