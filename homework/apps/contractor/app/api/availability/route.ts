import { createServerClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

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

// GET /api/availability - Get weekly schedule
export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const contractorId = await getContractorId(supabase);

    if (!contractorId) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const { data: availability, error } = await supabase
      .from('contractor_availability')
      .select('*')
      .eq('contractor_id', contractorId)
      .order('day_of_week');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also get daily capacity
    const { data: capacity, error: capError } = await supabase
      .from('contractor_daily_capacity')
      .select('*')
      .eq('contractor_id', contractorId)
      .order('day_of_week');

    if (capError) {
      return NextResponse.json({ error: capError.message }, { status: 500 });
    }

    return NextResponse.json({ availability, capacity });
  } catch (err) {
    console.error('GET /api/availability error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/availability - Update weekly schedule (upsert all 7 days)
export async function PUT(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const contractorId = await getContractorId(supabase);

    if (!contractorId) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const body = await request.json();
    const { schedule } = body;

    if (!schedule || !Array.isArray(schedule)) {
      return NextResponse.json({ error: 'schedule array is required' }, { status: 400 });
    }

    // Delete existing availability and re-insert
    const { error: deleteError } = await supabase
      .from('contractor_availability')
      .delete()
      .eq('contractor_id', contractorId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Insert new schedule
    const rows = schedule.map((day: {
      day_of_week: number;
      start_time: string;
      end_time: string;
      is_available: boolean;
    }) => ({
      contractor_id: contractorId,
      day_of_week: day.day_of_week,
      start_time: day.start_time,
      end_time: day.end_time,
      is_available: day.is_available,
    }));

    const { data: availability, error: insertError } = await supabase
      .from('contractor_availability')
      .insert(rows)
      .select();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ availability });
  } catch (err) {
    console.error('PUT /api/availability error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
