import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/homes/[id]
 * Get a specific home by ID. Auth required - user can only access own homes.
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

    const { data: home, error } = await supabase
      .from('homes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Home not found' }, { status: 404 });
      }
      console.error('Error fetching home:', error);
      return NextResponse.json({ error: 'Failed to fetch home' }, { status: 500 });
    }

    return NextResponse.json({ home });
  } catch (err) {
    console.error('Unexpected error in GET /api/homes/[id]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/homes/[id]
 * Update a home profile. Auth required - user can only update own homes.
 *
 * Body: Partial home fields to update.
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

    const body = await request.json();

    if (body.zip_code && !/^\d{5}$/.test(body.zip_code)) {
      return NextResponse.json({ error: 'zip_code must be a valid 5-digit zip code' }, { status: 400 });
    }

    // Only allow updating specific fields
    const allowedFields = [
      'address_line_1', 'address_line_2', 'city', 'state', 'zip_code',
      'lat', 'lng', 'sqft', 'year_built', 'stories', 'lot_sqft',
      'property_type', 'foundation_type', 'exterior_type', 'bedrooms', 'bathrooms',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: home, error } = await supabase
      .from('homes')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Home not found' }, { status: 404 });
      }
      console.error('Error updating home:', error);
      return NextResponse.json({ error: 'Failed to update home' }, { status: 500 });
    }

    return NextResponse.json({ home });
  } catch (err) {
    console.error('Unexpected error in PUT /api/homes/[id]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/homes/[id]
 * Delete a home profile. Auth required - user can only delete own homes.
 */
export async function DELETE(
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

    const { error } = await supabase
      .from('homes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting home:', error);
      return NextResponse.json({ error: 'Failed to delete home' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Unexpected error in DELETE /api/homes/[id]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
