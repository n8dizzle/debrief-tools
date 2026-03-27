import { createServerClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

const getSupabaseServerClient = createServerClient;

async function getContractorId(supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .single();

  return contractor?.id || null;
}

// PUT /api/prices/[serviceId] - Update price for a service
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const supabase = await getSupabaseServerClient();
    const contractorId = await getContractorId(supabase);
    const { serviceId } = await params;

    if (!contractorId) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const body = await request.json();
    const { base_price, variable_pricing, addon_pricing, is_active } = body;

    const updateData: Record<string, unknown> = {};
    if (base_price !== undefined) updateData.base_price = Math.round(base_price);
    if (variable_pricing !== undefined) updateData.variable_pricing = variable_pricing;
    if (addon_pricing !== undefined) updateData.addon_pricing = addon_pricing;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: price, error } = await supabase
      .from('contractor_prices')
      .update(updateData)
      .eq('contractor_id', contractorId)
      .eq('service_id', serviceId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Price not found for this service' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ price });
  } catch (err) {
    console.error('PUT /api/prices/[serviceId] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/prices/[serviceId] - Remove price for a service
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const supabase = await getSupabaseServerClient();
    const contractorId = await getContractorId(supabase);
    const { serviceId } = await params;

    if (!contractorId) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('contractor_prices')
      .delete()
      .eq('contractor_id', contractorId)
      .eq('service_id', serviceId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/prices/[serviceId] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
