import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: serviceId } = await params;
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('catalog_service_addons')
      .select('*')
      .eq('service_id', serviceId)
      .order('display_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/catalog/services/[id]/addons error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: serviceId } = await params;
    const supabase = createServerSupabaseClient();
    const body = await request.json();

    // Verify service exists
    const { data: svc, error: svcError } = await supabase
      .from('catalog_services')
      .select('id')
      .eq('id', serviceId)
      .single();

    if (svcError || !svc) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const { name, description, suggested_price, display_order, is_active } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('catalog_service_addons')
      .insert({
        service_id: serviceId,
        name,
        description: description || null,
        suggested_price: suggested_price || null,
        display_order: display_order ?? 0,
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('POST /api/catalog/services/[id]/addons error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: serviceId } = await params;
    const supabase = createServerSupabaseClient();
    const body = await request.json();

    const { addon_id, name, description, suggested_price, display_order, is_active } = body;

    if (!addon_id) {
      return NextResponse.json({ error: 'addon_id is required' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (suggested_price !== undefined) updates.suggested_price = suggested_price;
    if (display_order !== undefined) updates.display_order = display_order;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('catalog_service_addons')
      .update(updates)
      .eq('id', addon_id)
      .eq('service_id', serviceId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Addon not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('PUT /api/catalog/services/[id]/addons error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: serviceId } = await params;
    const supabase = createServerSupabaseClient();
    const { addon_id } = await request.json();

    if (!addon_id) {
      return NextResponse.json({ error: 'addon_id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('catalog_service_addons')
      .delete()
      .eq('id', addon_id)
      .eq('service_id', serviceId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/catalog/services/[id]/addons error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
