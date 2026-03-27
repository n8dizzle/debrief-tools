import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('contractors')
      .select(`
        *,
        contractor_trades(
          id, department_id,
          catalog_departments(id, name, slug)
        ),
        contractor_service_areas(
          id, zip_code, is_active
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = {
      ...data,
      trades: (data.contractor_trades || []).map((t: any) => ({
        id: t.id,
        department_id: t.department_id,
        department: t.catalog_departments,
      })),
      service_areas: data.contractor_service_areas || [],
      contractor_trades: undefined,
      contractor_service_areas: undefined,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/contractors/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
