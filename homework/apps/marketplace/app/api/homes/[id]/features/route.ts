import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/homes/[id]/features
 * Get home features for HomeFit matching. Auth required.
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

    const { data: features, error } = await supabase
      .from('home_features')
      .select('*')
      .eq('home_id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No features record yet - return empty/defaults
        return NextResponse.json({ features: null });
      }
      console.error('Error fetching home features:', error);
      return NextResponse.json({ error: 'Failed to fetch home features' }, { status: 500 });
    }

    return NextResponse.json({ features });
  } catch (err) {
    console.error('Unexpected error in GET /api/homes/[id]/features:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/homes/[id]/features
 * Create or update home features. Auth required.
 *
 * Body: { has_pool?, has_sprinkler_system?, has_fence?, fence_material?,
 *         has_gas_line?, has_central_hvac?, has_ductwork?, has_mini_split?,
 *         has_tankless_water_heater?, has_gutters?, has_outdoor_kitchen? }
 */
export async function PUT(
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

    const allowedFields = [
      'has_pool', 'has_sprinkler_system', 'has_fence', 'fence_material',
      'has_gas_line', 'has_central_hvac', 'has_ductwork', 'has_mini_split',
      'has_tankless_water_heater', 'has_gutters', 'has_outdoor_kitchen',
    ];

    const featureData: Record<string, unknown> = { home_id: id };
    for (const field of allowedFields) {
      if (field in body) {
        featureData[field] = body[field];
      }
    }

    // Upsert: create if not exists, update if exists
    const { data: features, error } = await supabase
      .from('home_features')
      .upsert(featureData, { onConflict: 'home_id' })
      .select()
      .single();

    if (error) {
      console.error('Error updating home features:', error);
      return NextResponse.json({ error: 'Failed to update home features' }, { status: 500 });
    }

    return NextResponse.json({ features });
  } catch (err) {
    console.error('Unexpected error in PUT /api/homes/[id]/features:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
