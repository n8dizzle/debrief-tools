import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { dbRowToTierConfig } from '@/lib/tiers';

export const dynamic = 'force-dynamic';

// GET /api/settings/tiers — read all tier configs
export async function GET() {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('estimate_tier_configs')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw new Error(error.message);

    const tiers = (data || []).map(dbRowToTierConfig);
    return NextResponse.json({ tiers });
  } catch (err) {
    console.error('[Tier Configs] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load tier configs' },
      { status: 500 }
    );
  }
}

// PATCH /api/settings/tiers — update a single tier config
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Tier id required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { error } = await supabase
      .from('estimate_tier_configs')
      .update(updates)
      .eq('id', id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Tier Configs] Update error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update' },
      { status: 500 }
    );
  }
}
