import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    let query = supabase
      .from('contractors')
      .select(`
        *,
        contractor_trades(
          id, department_id,
          catalog_departments(id, name, slug)
        ),
        contractor_service_areas(count)
      `)
      .order('member_since', { ascending: false });

    if (status) {
      query = query.eq('verification_status', status);
    }

    if (search) {
      query = query.or(
        `business_name.ilike.%${search}%,owner_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = (data || []).map((contractor: any) => ({
      ...contractor,
      trades: (contractor.contractor_trades || []).map((t: any) => ({
        id: t.id,
        department_id: t.department_id,
        department: t.catalog_departments,
      })),
      service_area_count: contractor.contractor_service_areas?.[0]?.count || 0,
      contractor_trades: undefined,
      contractor_service_areas: undefined,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/contractors error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();

    const { id, verification_status } = body;

    if (!id || !verification_status) {
      return NextResponse.json(
        { error: 'id and verification_status are required' },
        { status: 400 }
      );
    }

    const validStatuses = ['pending', 'approved', 'rejected', 'suspended'];
    if (!validStatuses.includes(verification_status)) {
      return NextResponse.json(
        { error: `verification_status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('contractors')
      .update({ verification_status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('PUT /api/contractors error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
