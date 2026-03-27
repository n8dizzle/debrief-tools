import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/homes/[id]/systems
 * Get all home systems (HVAC, water heater, etc.) for a home. Auth required.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify home ownership
    const { data: home, error: homeError } = await supabase
      .from('homes')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (homeError || !home) {
      return NextResponse.json({ error: 'Home not found' }, { status: 404 });
    }

    const { data: systems, error } = await supabase
      .from('home_systems')
      .select('*')
      .eq('home_id', id)
      .order('system_type', { ascending: true });

    if (error) {
      console.error('Error fetching home systems:', error);
      return NextResponse.json({ error: 'Failed to fetch home systems' }, { status: 500 });
    }

    return NextResponse.json({ systems: systems || [] });
  } catch (err) {
    console.error('Unexpected error in GET /api/homes/[id]/systems:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/homes/[id]/systems
 * Add a home system (HVAC unit, water heater, etc.). Auth required.
 *
 * Body: { system_type, brand?, model?, fuel_type?, capacity?, year_installed? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify home ownership
    const { data: home, error: homeError } = await supabase
      .from('homes')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (homeError || !home) {
      return NextResponse.json({ error: 'Home not found' }, { status: 404 });
    }

    const body = await request.json();

    if (!body.system_type) {
      return NextResponse.json({ error: 'system_type is required' }, { status: 400 });
    }

    const { data: system, error } = await supabase
      .from('home_systems')
      .insert({
        home_id: id,
        system_type: body.system_type,
        brand: body.brand || null,
        model: body.model || null,
        fuel_type: body.fuel_type || null,
        capacity: body.capacity || null,
        year_installed: body.year_installed || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating home system:', error);
      return NextResponse.json({ error: 'Failed to create home system' }, { status: 500 });
    }

    return NextResponse.json({ system }, { status: 201 });
  } catch (err) {
    console.error('Unexpected error in POST /api/homes/[id]/systems:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
