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
      .from('catalog_service_variables')
      .select('*')
      .eq('service_id', serviceId)
      .order('display_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/catalog/services/[id]/variables error:', err);
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

    const {
      name,
      label,
      description,
      variable_type,
      options,
      is_required,
      affects_pricing,
      display_order,
    } = body;

    if (!name || !label || !variable_type) {
      return NextResponse.json(
        { error: 'name, label, and variable_type are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('catalog_service_variables')
      .insert({
        service_id: serviceId,
        name,
        label,
        description: description || null,
        variable_type,
        options: options || null,
        is_required: is_required ?? false,
        affects_pricing: affects_pricing ?? false,
        display_order: display_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('POST /api/catalog/services/[id]/variables error:', err);
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

    const { variable_id, name, label, description, variable_type, options, is_required, affects_pricing, display_order } = body;

    if (!variable_id) {
      return NextResponse.json({ error: 'variable_id is required' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (label !== undefined) updates.label = label;
    if (description !== undefined) updates.description = description;
    if (variable_type !== undefined) updates.variable_type = variable_type;
    if (options !== undefined) updates.options = options;
    if (is_required !== undefined) updates.is_required = is_required;
    if (affects_pricing !== undefined) updates.affects_pricing = affects_pricing;
    if (display_order !== undefined) updates.display_order = display_order;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('catalog_service_variables')
      .update(updates)
      .eq('id', variable_id)
      .eq('service_id', serviceId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Variable not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('PUT /api/catalog/services/[id]/variables error:', err);
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
    const { variable_id } = await request.json();

    if (!variable_id) {
      return NextResponse.json({ error: 'variable_id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('catalog_service_variables')
      .delete()
      .eq('id', variable_id)
      .eq('service_id', serviceId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/catalog/services/[id]/variables error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
