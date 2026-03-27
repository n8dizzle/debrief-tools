import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addonId: string }> }
) {
  try {
    const { id: serviceId, addonId } = await params;
    const supabase = createServerSupabaseClient();
    const body = await request.json();

    const allowedFields = ['name', 'description', 'suggested_price', 'display_order', 'is_active'];

    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('catalog_service_addons')
      .update(updates)
      .eq('id', addonId)
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
    console.error('PUT /api/catalog/services/[id]/addons/[addonId] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addonId: string }> }
) {
  try {
    const { id: serviceId, addonId } = await params;
    const supabase = createServerSupabaseClient();

    const { error } = await supabase
      .from('catalog_service_addons')
      .delete()
      .eq('id', addonId)
      .eq('service_id', serviceId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/catalog/services/[id]/addons/[addonId] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
