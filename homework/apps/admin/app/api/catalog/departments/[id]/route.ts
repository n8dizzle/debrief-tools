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
      .from('catalog_departments')
      .select('*, catalog_categories(count)')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Department not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get service count for this department
    const { data: serviceCounts, error: serviceError } = await supabase
      .from('catalog_categories')
      .select('catalog_services(count)')
      .eq('department_id', id);

    let serviceCount = 0;
    if (!serviceError && serviceCounts) {
      for (const cat of serviceCounts) {
        serviceCount += (cat as any).catalog_services?.[0]?.count || 0;
      }
    }

    const result = {
      ...data,
      category_count: data.catalog_categories?.[0]?.count || 0,
      service_count: serviceCount,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/catalog/departments/[id] error:', err);
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

    const { name, slug, description, icon, display_order, is_active } = body;

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (slug !== undefined) updates.slug = slug;
    if (description !== undefined) updates.description = description;
    if (icon !== undefined) updates.icon = icon;
    if (display_order !== undefined) updates.display_order = display_order;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('catalog_departments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Department not found' }, { status: 404 });
      }
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A department with this slug already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('PUT /api/catalog/departments/[id] error:', err);
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

    // Check for associated categories first
    const { count, error: countError } = await supabase
      .from('catalog_categories')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', id);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete department: ${count} categories still reference it. Remove or reassign them first.` },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from('catalog_departments')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/catalog/departments/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
