import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const departmentId = searchParams.get('department_id');
    const search = searchParams.get('search');

    let query = supabase
      .from('catalog_categories')
      .select('*, catalog_departments!inner(id, name, slug), catalog_services(count)')
      .order('display_order', { ascending: true });

    if (departmentId) {
      query = query.eq('department_id', departmentId);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = (data || []).map((cat: any) => ({
      ...cat,
      department: cat.catalog_departments,
      service_count: cat.catalog_services?.[0]?.count || 0,
      catalog_departments: undefined,
      catalog_services: undefined,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/catalog/categories error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();

    const { department_id, name, slug, description, icon, display_order, is_active } = body;

    if (!department_id || !name || !slug) {
      return NextResponse.json(
        { error: 'department_id, name, and slug are required' },
        { status: 400 }
      );
    }

    // Verify department exists
    const { data: dept, error: deptError } = await supabase
      .from('catalog_departments')
      .select('id')
      .eq('id', department_id)
      .single();

    if (deptError || !dept) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from('catalog_categories')
      .insert({
        department_id,
        name,
        slug,
        description: description || null,
        icon: icon || null,
        display_order: display_order ?? 0,
        is_active: is_active ?? true,
      })
      .select('*, catalog_departments(id, name, slug)')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A category with this slug already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = {
      ...data,
      department: (data as any).catalog_departments,
      catalog_departments: undefined,
    };

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('POST /api/catalog/categories error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
