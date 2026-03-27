import { createServerClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

const getSupabaseServerClient = createServerClient;

// GET /api/profile - Get contractor profile for the logged-in user
export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: contractor, error } = await supabase
      .from('contractors')
      .select(`
        *,
        contractor_trades (
          id,
          department_id,
          catalog_departments (id, name, slug)
        ),
        contractor_service_areas (
          id,
          zip_code,
          is_active
        )
      `)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No contractor record found
        return NextResponse.json({ contractor: null }, { status: 200 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ contractor });
  } catch (err) {
    console.error('GET /api/profile error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/profile - Update contractor profile
export async function PUT(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { business_name, owner_name, phone, email, logo_url } = body;

    // Find the contractor record
    const { data: contractor, error: findError } = await supabase
      .from('contractors')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (findError || !contractor) {
      return NextResponse.json({ error: 'Contractor profile not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (business_name !== undefined) updateData.business_name = business_name;
    if (owner_name !== undefined) updateData.owner_name = owner_name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (logo_url !== undefined) updateData.logo_url = logo_url;

    const { data: updated, error: updateError } = await supabase
      .from('contractors')
      .update(updateData)
      .eq('id', contractor.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ contractor: updated });
  } catch (err) {
    console.error('PUT /api/profile error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
