import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// GET /api/nominations/periods - List nomination periods
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  const { data: periods, error } = await supabase
    .from('cel_nomination_periods')
    .select('*, cel_nominations(count)')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const transformed = (periods || []).map((p: any) => ({
    ...p,
    nomination_count: p.cel_nominations?.[0]?.count ?? 0,
    cel_nominations: undefined,
  }));

  return NextResponse.json({ periods: transformed });
}

// POST /api/nominations/periods - Create nomination period
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, status, opens_at, closes_at, categories, period_type, year, quarter } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const validStatuses = ['draft', 'open', 'closed'];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  const { data: period, error } = await supabase
    .from('cel_nomination_periods')
    .insert({
      title: title.trim(),
      description: description?.trim() || null,
      status: status || 'draft',
      opens_at: opens_at || null,
      closes_at: closes_at || null,
      categories: Array.isArray(categories) ? categories : [],
      period_type: period_type || 'quarterly',
      year: year || null,
      quarter: quarter || null,
      created_by: session.user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ period }, { status: 201 });
}
