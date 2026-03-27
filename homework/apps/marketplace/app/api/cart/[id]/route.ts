import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * PUT /api/cart/[id]
 * Update a cart item. Auth required - user can only update own cart items.
 *
 * Body: { selected_variables?, selected_addons?, preferred_date?,
 *         preferred_time_slot?, quantity?, notes? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const allowedFields = [
      'selected_variables', 'selected_addons', 'preferred_date',
      'preferred_time_slot', 'quantity', 'notes',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Ensure quantity is at least 1
    if (updates.quantity !== undefined && (typeof updates.quantity !== 'number' || updates.quantity < 1)) {
      return NextResponse.json({ error: 'quantity must be at least 1' }, { status: 400 });
    }

    const { data: item, error } = await supabase
      .from('cart_items')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select(
        `
        *,
        service:catalog_services(id, name, slug, short_description, image_url),
        contractor:contractors(id, business_name, logo_url),
        home:homes(id, address_line_1, city, state, zip_code)
        `
      )
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Cart item not found' }, { status: 404 });
      }
      console.error('Error updating cart item:', error);
      return NextResponse.json({ error: 'Failed to update cart item' }, { status: 500 });
    }

    return NextResponse.json({ item });
  } catch (err) {
    console.error('Unexpected error in PUT /api/cart/[id]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/cart/[id]
 * Remove a cart item. Auth required - user can only delete own cart items.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting cart item:', error);
      return NextResponse.json({ error: 'Failed to delete cart item' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Unexpected error in DELETE /api/cart/[id]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
