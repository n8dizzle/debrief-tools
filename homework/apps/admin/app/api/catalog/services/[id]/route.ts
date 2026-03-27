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
      .from('catalog_services')
      .select(`
        *,
        catalog_categories!inner(
          id, name, slug, department_id,
          catalog_departments!inner(id, name, slug)
        ),
        catalog_service_variables(
          id, name, label, description, variable_type,
          options, is_required, affects_pricing, display_order
        ),
        catalog_service_addons(
          id, name, description, suggested_price,
          display_order, is_active
        )
      `)
      .eq('id', id)
      .order('display_order', { referencedTable: 'catalog_service_variables', ascending: true })
      .order('display_order', { referencedTable: 'catalog_service_addons', ascending: true })
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = {
      ...data,
      category: {
        id: data.catalog_categories?.id,
        name: data.catalog_categories?.name,
        slug: data.catalog_categories?.slug,
      },
      department: {
        id: (data.catalog_categories as any)?.catalog_departments?.id,
        name: (data.catalog_categories as any)?.catalog_departments?.name,
        slug: (data.catalog_categories as any)?.catalog_departments?.slug,
      },
      variables: data.catalog_service_variables || [],
      addons: data.catalog_service_addons || [],
      catalog_categories: undefined,
      catalog_service_variables: undefined,
      catalog_service_addons: undefined,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/catalog/services/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerSupabaseClient();
    const body = await request.json();

    const allowedFields = [
      'category_id', 'name', 'slug', 'short_description', 'description',
      'scope_includes', 'scope_excludes', 'productizability', 'pricing_type',
      'launch_wave', 'homefit_rules', 'estimated_duration_min', 'estimated_duration_max',
      'icon', 'image_url', 'display_order', 'is_active', 'is_featured', 'metadata',
    ];

    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // If changing category, verify it exists
    if (updates.category_id) {
      const { data: cat, error: catError } = await supabase
        .from('catalog_categories')
        .select('id')
        .eq('id', updates.category_id)
        .single();

      if (catError || !cat) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }
    }

    const { data, error } = await supabase
      .from('catalog_services')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        catalog_categories!inner(
          id, name, slug,
          catalog_departments!inner(id, name, slug)
        )
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 });
      }
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

    return NextResponse.json(result);
  } catch (err) {
    console.error('PUT /api/catalog/services/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerSupabaseClient();

    // Delete associated variables and addons first (cascade)
    const { error: varError } = await supabase
      .from('catalog_service_variables')
      .delete()
      .eq('service_id', id);

    if (varError) {
      return NextResponse.json({ error: `Failed to delete variables: ${varError.message}` }, { status: 500 });
    }

    const { error: addonError } = await supabase
      .from('catalog_service_addons')
      .delete()
      .eq('service_id', id);

    if (addonError) {
      return NextResponse.json({ error: `Failed to delete addons: ${addonError.message}` }, { status: 500 });
    }

    const { error } = await supabase
      .from('catalog_services')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/catalog/services/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
