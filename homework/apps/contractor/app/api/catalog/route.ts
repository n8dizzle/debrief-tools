import { createServerClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

const getSupabaseServerClient = createServerClient;

// GET /api/catalog - Get catalog services (read-only, for browsing what to price)
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', detail: authError?.message }, { status: 401 });
    }

    // DEBUG: log user
    console.log('CATALOG DEBUG: user=', user.id, user.email);

    const { searchParams } = request.nextUrl;
    const departmentId = searchParams.get('department_id');
    const categoryId = searchParams.get('category_id');
    const search = searchParams.get('search');

    // Fetch departments
    const { data: departments, error: deptError } = await supabase
      .from('catalog_departments')
      .select('id, name, slug, description, display_order')
      .order('display_order');

    if (deptError) {
      return NextResponse.json({ error: 'dept: ' + deptError.message, code: deptError.code }, { status: 500 });
    }

    // Fetch categories
    let categoriesQuery = supabase
      .from('catalog_categories')
      .select('id, department_id, name, slug, description, display_order')
      .order('display_order');

    if (departmentId) {
      categoriesQuery = categoriesQuery.eq('department_id', departmentId);
    }

    const { data: categories, error: catError } = await categoriesQuery;

    if (catError) {
      return NextResponse.json({ error: 'cat: ' + catError.message, code: catError.code }, { status: 500 });
    }

    // Fetch services
    let servicesQuery = supabase
      .from('catalog_services')
      .select(`
        id,
        category_id,
        name,
        slug,
        description,
        scope_includes,
        scope_excludes,
        pricing_type,
        productizability,
        estimated_duration_min,
        estimated_duration_max,
        is_active,
        display_order,
        catalog_categories (
          id,
          name,
          department_id,
          catalog_departments (id, name)
        )
      `)
      .eq('is_active', true)
      .order('display_order');

    if (categoryId) {
      servicesQuery = servicesQuery.eq('category_id', categoryId);
    }

    if (departmentId) {
      // Filter services by department through category
      const categoryIds = (categories || []).map(c => c.id);
      if (categoryIds.length > 0) {
        servicesQuery = servicesQuery.in('category_id', categoryIds);
      }
    }

    if (search) {
      servicesQuery = servicesQuery.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: services, error: svcError } = await servicesQuery;

    if (svcError) {
      return NextResponse.json({ error: 'svc: ' + svcError.message, code: svcError.code }, { status: 500 });
    }

    return NextResponse.json({ departments, categories, services });
  } catch (err) {
    console.error('GET /api/catalog error:', err instanceof Error ? err.message : err, err instanceof Error ? err.stack : '');
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
