import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');

    let query = supabase
      .from('catalog_departments')
      .select('*, catalog_categories(count)')
      .order('display_order', { ascending: true });

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data: departments, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch service counts per department via categories
    const departmentIds = departments.map((d: any) => d.id);

    const { data: serviceCounts, error: serviceError } = await supabase
      .from('catalog_categories')
      .select('department_id, catalog_services(count)')
      .in('department_id', departmentIds);

    if (serviceError) {
      return NextResponse.json({ error: serviceError.message }, { status: 500 });
    }

    // Aggregate service counts by department
    const serviceCountByDept: Record<string, number> = {};
    for (const cat of serviceCounts || []) {
      const deptId = cat.department_id;
      const count = (cat as any).catalog_services?.[0]?.count || 0;
      serviceCountByDept[deptId] = (serviceCountByDept[deptId] || 0) + count;
    }

    const result = departments.map((dept: any) => ({
      ...dept,
      category_count: dept.catalog_categories?.[0]?.count || 0,
      service_count: serviceCountByDept[dept.id] || 0,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/catalog/departments error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();

    const { name, slug, description, icon, display_order, is_active } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'name and slug are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('catalog_departments')
      .insert({
        name,
        slug,
        description: description || null,
        icon: icon || null,
        display_order: display_order ?? 0,
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A department with this slug already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('POST /api/catalog/departments error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
