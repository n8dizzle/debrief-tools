import { createServerClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

const getSupabaseServerClient = createServerClient;

async function getContractorId(supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .single();

  return contractor?.id || null;
}

// GET /api/availability/blocked-dates - Get blocked dates
export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const contractorId = await getContractorId(supabase);

    if (!contractorId) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const { data: blockedDates, error } = await supabase
      .from('contractor_blocked_dates')
      .select('*')
      .eq('contractor_id', contractorId)
      .order('blocked_date');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ blocked_dates: blockedDates });
  } catch (err) {
    console.error('GET /api/availability/blocked-dates error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/availability/blocked-dates - Add blocked date
export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const contractorId = await getContractorId(supabase);

    if (!contractorId) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const body = await request.json();
    const { blocked_date, reason } = body;

    if (!blocked_date) {
      return NextResponse.json({ error: 'blocked_date is required' }, { status: 400 });
    }

    const { data: blockedDate, error } = await supabase
      .from('contractor_blocked_dates')
      .insert({
        contractor_id: contractorId,
        blocked_date,
        reason: reason || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ blocked_date: blockedDate }, { status: 201 });
  } catch (err) {
    console.error('POST /api/availability/blocked-dates error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/availability/blocked-dates?id=xxx - Remove blocked date
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const contractorId = await getContractorId(supabase);

    if (!contractorId) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('contractor_blocked_dates')
      .delete()
      .eq('id', id)
      .eq('contractor_id', contractorId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/availability/blocked-dates error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
