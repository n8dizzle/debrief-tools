import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const departmentId = searchParams.get('department_id');
    const categoryId = searchParams.get('category_id');
    const wave = searchParams.get('wave');
    const pricingType = searchParams.get('pricing_type');
    const isActive = searchParams.get('is_active');
    const isFeatured = searchParams.get('is_featured');
    const search = searchParams.get('search');

    let query = supabase
      .from('catalog_services')
      .select(`
        *,
        catalog_categories!inner(
          id, name, slug,
          catalog_departments!inner(id, name, slug)
        )
      `)
      .order('display_order', { ascending: true });

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (departmentId) {
      query = query.eq('catalog_categories.department_id', departmentId);
    }

    if (wave) {
      query = query.eq('launch_wave', parseInt(wave));
    }

    if (pricingType) {
      query = query.eq('pricing_type', pricingType);
    }

    if (isActive !== null && isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true');
    }

    if (isFeatured !== null && isFeatured !== undefined) {
      query = query.eq('is_featured', isFeatured === 'true');
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,short_description.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = (data || []).map((svc: any) => ({
      ...svc,
      category: {
        id: svc.catalog_categories?.id,
        name: svc.catalog_categories?.name,
        slug: svc.catalog_categories?.slug,
      },
      department: {
        id: svc.catalog_categories?.catalog_departments?.id,
        name: svc.catalog_categories?.catalog_departments?.name,
        slug: svc.catalog_categories?.catalog_departments?.slug,
      },
      catalog_categories: undefined,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/catalog/services error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();

    const {
      category_id,
      name,
      slug,
      short_description,
      description,
      scope_includes,
      scope_excludes,
      productizability,
      pricing_type,
      launch_wave,
      homefit_rules,
      estimated_duration_min,
      estimated_duration_max,
      icon,
      image_url,
      display_order,
      is_active,
      is_featured,
      metadata,
    } = body;

    if (!category_id || !name || !slug) {
      return NextResponse.json(
        { error: 'category_id, name, and slug are required' },
        { status: 400 }
      );
    }

    // Verify category exists
    const { data: cat, error: catError } = await supabase
      .from('catalog_categories')
      .select('id')
      .eq('id', category_id)
      .single();

    if (catError || !cat) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from('catalog_services')
      .insert({
        category_id,
        name,
        slug,
        short_description: short_description || null,
        description: description || null,
        scope_includes: scope_includes || null,
        scope_excludes: scope_excludes || null,
        productizability: productizability || null,
        pricing_type: pricing_type || null,
        launch_wave: launch_wave || null,
        homefit_rules: homefit_rules || null,
        estimated_duration_min: estimated_duration_min || null,
        estimated_duration_max: estimated_duration_max || null,
        icon: icon || null,
        image_url: image_url || null,
        display_order: display_order ?? 0,
        is_active: is_active ?? true,
        is_featured: is_featured ?? false,
        metadata: metadata || null,
      })
      .select(`
        *,
        catalog_categories!inner(
          id, name, slug,
          catalog_departments!inner(id, name, slug)
        )
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A service with this slug already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = {
      ...data,
      category: {
        id: (data as any).catalog_categories?.id,
        name: (data as any).catalog_categories?.name,
        slug: (data as any).catalog_categories?.slug,
      },
      department: {
        id: (data as any).catalog_categories?.catalog_departments?.id,
        name: (data as any).catalog_categories?.catalog_departments?.name,
        slug: (data as any).catalog_categories?.catalog_departments?.slug,
      },
      catalog_categories: undefined,
    };

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('POST /api/catalog/services error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
