import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

/**
 * GET /api/reviews/locations
 * Get all Google Business locations
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('google_locations')
    .select('*')
    .order('display_order');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/reviews/locations
 * Create a new location
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role } = session.user as { role?: string };
  if (role !== 'owner') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
  }

  const body = await request.json();
  const { name, short_name, place_id, google_account_id, google_location_id, address } = body;

  if (!name || !short_name) {
    return NextResponse.json(
      { error: 'Name and short_name are required' },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();

  // Get max display_order
  const { data: maxOrder } = await supabase
    .from('google_locations')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .single();

  const { data, error } = await supabase
    .from('google_locations')
    .insert({
      name,
      short_name,
      place_id,
      google_account_id,
      google_location_id,
      address,
      display_order: (maxOrder?.display_order || 0) + 1,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

/**
 * PATCH /api/reviews/locations
 * Update a location
 */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role } = session.user as { role?: string };
  if (role !== 'owner') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: 'Location ID required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('google_locations')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
