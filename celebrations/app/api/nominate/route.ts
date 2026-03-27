import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

// GET /api/nominate - Get the currently open nomination period (public, no auth)
export async function GET() {
  const supabase = getServerSupabase();

  const { data: period, error } = await supabase
    .from('cel_nomination_periods')
    .select('id, title, description, status, opens_at, closes_at, categories')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ period });
}

// POST /api/nominate - Submit a nomination (public, no auth required)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { period_id, nominee_name, nominator_name, company_value, story, event_date } = body;

  if (!period_id) {
    return NextResponse.json({ error: 'Period is required' }, { status: 400 });
  }
  if (!nominee_name?.trim()) {
    return NextResponse.json({ error: 'Nominee name is required' }, { status: 400 });
  }
  if (!nominator_name?.trim()) {
    return NextResponse.json({ error: 'Your name is required' }, { status: 400 });
  }
  if (!company_value) {
    return NextResponse.json({ error: 'Category is required' }, { status: 400 });
  }
  if (!story?.trim()) {
    return NextResponse.json({ error: 'Story is required' }, { status: 400 });
  }

  // Prevent self-nomination
  if (nominee_name.trim().toLowerCase() === nominator_name.trim().toLowerCase()) {
    return NextResponse.json({ error: 'You cannot nominate yourself' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Verify period is open and validate category against period's categories
  const { data: period, error: periodError } = await supabase
    .from('cel_nomination_periods')
    .select('id, status, categories')
    .eq('id', period_id)
    .single();

  if (periodError || !period) {
    return NextResponse.json({ error: 'Period not found' }, { status: 404 });
  }

  if (period.status !== 'open') {
    return NextResponse.json({ error: 'This nomination period is not currently open' }, { status: 400 });
  }

  const validKeys = (period.categories || []).map((c: any) => c.key);
  if (validKeys.length > 0 && !validKeys.includes(company_value)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }

  const { data: nomination, error } = await supabase
    .from('cel_nominations')
    .insert({
      period_id,
      nominee_name: nominee_name.trim(),
      nominator_user_id: null,
      nominator_name: nominator_name.trim(),
      company_value,
      story: story.trim(),
      event_date: event_date || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ nomination }, { status: 201 });
}
