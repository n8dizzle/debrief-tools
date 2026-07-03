import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/estimates/[id] — get estimate with options
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('estimates')
      .select('*, estimate_options(*)')
      .eq('id', params.id)
      .single();

    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Sort options by sort_order
    if (data.estimate_options) {
      data.estimate_options.sort((a: any, b: any) => a.sort_order - b.sort_order);
    }

    return NextResponse.json({ estimate: data });
  } catch (err) {
    console.error('[Estimate] Get error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

// PATCH /api/estimates/[id] — update estimate fields
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const supabase = getServerSupabase();

    // Separate options from estimate fields
    const { options, ...estimateFields } = body;

    // Update estimate
    if (Object.keys(estimateFields).length > 0) {
      const { error } = await supabase
        .from('estimates')
        .update(estimateFields)
        .eq('id', params.id);
      if (error) throw new Error(error.message);
    }

    // Upsert options if provided
    if (options && Array.isArray(options)) {
      // Delete existing options and re-insert (simpler than individual upserts)
      await supabase.from('estimate_options').delete().eq('estimate_id', params.id);

      const rows = options.map((opt: any, idx: number) => ({
        id: opt.id || undefined,
        estimate_id: params.id,
        label: opt.label || `Option ${idx + 1}`,
        sort_order: idx,
        color: opt.color || null,
        hidden: opt.hidden || false,
        st_service_id: opt.stServiceId || null,
        st_service_code: opt.stServiceCode || null,
        system_name: opt.systemName || '',
        system_brand: opt.systemBrand || 'American Standard',
        system_seer: opt.systemSeer || null,
        system_stage: opt.systemStage || null,
        system_description: opt.systemDescription || null,
        system_price: opt.systemPrice || 0,
        labor_cost: opt.laborCost || 0,
        add_ons: opt.addOns || [],
        install_items: opt.installItems || [],
        equipment_refs: opt.equipmentRefs || [],
      }));

      const { error: optError } = await supabase.from('estimate_options').insert(rows);
      if (optError) throw new Error(optError.message);
    }

    // Return updated estimate
    const { data } = await supabase
      .from('estimates')
      .select('*, estimate_options(*)')
      .eq('id', params.id)
      .single();

    return NextResponse.json({ estimate: data });
  } catch (err) {
    console.error('[Estimate] Update error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

// DELETE /api/estimates/[id]
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase.from('estimates').delete().eq('id', params.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Estimate] Delete error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
