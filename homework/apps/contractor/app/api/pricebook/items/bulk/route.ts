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

interface BulkUpdateBody {
  item_ids: string[];
  updates: {
    markup_percent?: number;
    mapping_status?: string;
  };
}

// PUT /api/pricebook/items/bulk - Bulk update items
export async function PUT(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const contractorId = await getContractorId(supabase);

    if (!contractorId) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const body = (await request.json()) as BulkUpdateBody;
    const { item_ids, updates } = body;

    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      return NextResponse.json({ error: 'item_ids must be a non-empty array' }, { status: 400 });
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'updates object is required' }, { status: 400 });
    }

    const hasMarkupUpdate = updates.markup_percent !== undefined;
    const hasMappingStatusUpdate = updates.mapping_status !== undefined;

    if (!hasMarkupUpdate && !hasMappingStatusUpdate) {
      return NextResponse.json({ error: 'At least one update field (markup_percent, mapping_status) is required' }, { status: 400 });
    }

    // If markup_percent is changing, we need to recalculate retail_price per item
    if (hasMarkupUpdate) {
      // Fetch all items to get their supplier_cost for recalculation
      const { data: items, error: fetchError } = await supabase
        .from('pricebook_items')
        .select('id, supplier_cost')
        .in('id', item_ids)
        .eq('contractor_id', contractorId);

      if (fetchError) {
        console.error('PUT /api/pricebook/items/bulk fetch error:', fetchError);
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
      }

      if (!items || items.length === 0) {
        return NextResponse.json({ error: 'No matching items found' }, { status: 404 });
      }

      // Update each item individually to recalculate retail_price
      const updatePromises = items.map(item => {
        const updateData: Record<string, unknown> = {
          markup_percent: updates.markup_percent,
        };

        if (hasMappingStatusUpdate) {
          updateData.mapping_status = updates.mapping_status;
        }

        // Recalculate retail_price if supplier_cost exists
        if (item.supplier_cost !== null && updates.markup_percent !== undefined) {
          updateData.retail_price = Math.round(
            item.supplier_cost * (1 + updates.markup_percent / 100)
          );
        }

        return supabase
          .from('pricebook_items')
          .update(updateData)
          .eq('id', item.id)
          .eq('contractor_id', contractorId);
      });

      const results = await Promise.all(updatePromises);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        console.error('PUT /api/pricebook/items/bulk update errors:', errors.map(e => e.error));
        return NextResponse.json({ error: 'Some items failed to update' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        updated_count: items.length,
      });
    } else {
      // Simple bulk update without recalculation
      const updateData: Record<string, unknown> = {};
      if (hasMappingStatusUpdate) {
        updateData.mapping_status = updates.mapping_status;
      }

      const { error: updateError, count } = await supabase
        .from('pricebook_items')
        .update(updateData)
        .in('id', item_ids)
        .eq('contractor_id', contractorId);

      if (updateError) {
        console.error('PUT /api/pricebook/items/bulk update error:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        updated_count: count ?? item_ids.length,
      });
    }
  } catch (err) {
    console.error('PUT /api/pricebook/items/bulk error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
