import { createServerClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

const getSupabaseServerClient = createServerClient;

type SupabaseClient = Awaited<ReturnType<typeof getSupabaseServerClient>>;

async function getContractorId(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .single();

  return contractor?.id || null;
}

interface ItemUpdateBody {
  description?: string;
  category?: string;
  supplier_cost?: number;
  unit?: string;
  markup_percent?: number;
  retail_price?: number;
  mapped_service_id?: string | null;
  mapping_status?: string;
}

// GET /api/pricebook/items/[id] - Get a single item
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseServerClient();
    const contractorId = await getContractorId(supabase);
    const { id } = await params;

    if (!contractorId) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const { data: item, error } = await supabase
      .from('pricebook_items')
      .select(`
        id,
        supplier_list_id,
        part_number,
        description,
        category,
        supplier_cost,
        unit,
        markup_percent,
        retail_price,
        mapped_service_id,
        mapping_confidence,
        mapping_status,
        metadata,
        created_at,
        updated_at
      `)
      .eq('id', id)
      .eq('contractor_id', contractorId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }
      console.error('GET /api/pricebook/items/[id] error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ item });
  } catch (err) {
    console.error('GET /api/pricebook/items/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/pricebook/items/[id] - Update an item
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseServerClient();
    const contractorId = await getContractorId(supabase);
    const { id } = await params;

    if (!contractorId) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    // Verify ownership
    const { data: existing, error: findError } = await supabase
      .from('pricebook_items')
      .select('id, supplier_cost, markup_percent')
      .eq('id', id)
      .eq('contractor_id', contractorId)
      .single();

    if (findError) {
      if (findError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }
      console.error('PUT /api/pricebook/items/[id] find error:', findError);
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    const body = (await request.json()) as ItemUpdateBody;

    const updateData: Record<string, unknown> = {};

    // Apply allowed field updates
    if (body.description !== undefined) updateData.description = body.description;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.supplier_cost !== undefined) updateData.supplier_cost = body.supplier_cost;
    if (body.unit !== undefined) updateData.unit = body.unit;
    if (body.markup_percent !== undefined) updateData.markup_percent = body.markup_percent;
    if (body.retail_price !== undefined) updateData.retail_price = body.retail_price;
    if (body.mapped_service_id !== undefined) updateData.mapped_service_id = body.mapped_service_id;
    if (body.mapping_status !== undefined) updateData.mapping_status = body.mapping_status;

    // Recalculate retail_price when markup_percent or supplier_cost changes
    const supplierCost = (updateData.supplier_cost as number | undefined) ?? existing.supplier_cost;
    const markupPercent = (updateData.markup_percent as number | undefined) ?? existing.markup_percent;

    if (
      (body.markup_percent !== undefined || body.supplier_cost !== undefined) &&
      supplierCost !== null &&
      markupPercent !== null
    ) {
      updateData.retail_price = Math.round(supplierCost * (1 + markupPercent / 100));
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: item, error: updateError } = await supabase
      .from('pricebook_items')
      .update(updateData)
      .eq('id', id)
      .eq('contractor_id', contractorId)
      .select()
      .single();

    if (updateError) {
      console.error('PUT /api/pricebook/items/[id] update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ item });
  } catch (err) {
    console.error('PUT /api/pricebook/items/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/pricebook/items/[id] - Delete a single item
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseServerClient();
    const contractorId = await getContractorId(supabase);
    const { id } = await params;

    if (!contractorId) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    // Verify ownership and delete
    const { error: deleteError } = await supabase
      .from('pricebook_items')
      .delete()
      .eq('id', id)
      .eq('contractor_id', contractorId);

    if (deleteError) {
      console.error('DELETE /api/pricebook/items/[id] error:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/pricebook/items/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
