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
      .from('catalog_categories')
      .select('*, catalog_departments(id, name, slug), catalog_services(count)')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = {
      ...data,
      department: data.catalog_departments,
      service_count: (data as any).catalog_services?.[0]?.count || 0,
      catalog_departments: undefined,
      catalog_services: undefined,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/catalog/categories/[id] error:', err);
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

    const { department_id, name, slug, description, icon, display_order, is_active } = body;

    const updates: Record<string, any> = {};
    if (department_id !== undefined) updates.department_id = department_id;
    if (name !== undefined) updates.name = name;
    if (slug !== undefined) updates.slug = slug;
    if (description !== undefined) updates.description = description;
    if (icon !== undefined) updates.icon = icon;
    if (display_order !== undefined) updates.display_order = display_order;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // If changing department, verify it exists
    if (department_id) {
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
    }

    const { data, error } = await supabase
      .from('catalog_categories')
      .update(updates)
      .eq('id', id)
      .select('*, catalog_departments(id, name, slug)')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }
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

    return NextResponse.json(result);
  } catch (err) {
    console.error('PUT /api/catalog/categories/[id] error:', err);
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

    // Check for associated services first
    const { count, error: countError } = await supabase
      .from('catalog_services')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', id);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete category: ${count} services still reference it. Remove or reassign them first.` },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from('catalog_categories')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/catalog/categories/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
