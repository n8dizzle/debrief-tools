import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/settings/financing -- list all financing plans
export async function GET() {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('estimate_financing_plans')
      .select('*')
      .order('apr', { ascending: true })
      .order('months', { ascending: true });

    if (error) throw new Error(error.message);

    const plans = (data || []).map(row => ({
      id: row.id,
      source: row.source,
      stPlanCode: row.st_plan_code,
      name: row.name,
      months: row.months,
      apr: Number(row.apr),
      minAmount: Number(row.min_amount),
      applyUrl: row.apply_url,
      active: row.active,
      syncedAt: row.synced_at,
    }));

    return NextResponse.json({ plans });
  } catch (err) {
    console.error('[Financing] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load financing plans' },
      { status: 500 }
    );
  }
}

// POST /api/settings/financing -- create a manual financing plan
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, months, apr, minAmount, applyUrl } = body;

    if (!name || !months) {
      return NextResponse.json({ error: 'Name and months are required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('estimate_financing_plans')
      .insert({
        source: 'manual',
        name,
        months,
        apr: apr || 0,
        min_amount: minAmount || 0,
        apply_url: applyUrl || null,
        active: true,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ plan: data });
  } catch (err) {
    console.error('[Financing] Create error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create plan' },
      { status: 500 }
    );
  }
}

// PATCH /api/settings/financing -- update a financing plan
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Plan id required' }, { status: 400 });
    }

    // Map camelCase to snake_case for DB
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.months !== undefined) dbUpdates.months = updates.months;
    if (updates.apr !== undefined) dbUpdates.apr = updates.apr;
    if (updates.minAmount !== undefined) dbUpdates.min_amount = updates.minAmount;
    if (updates.applyUrl !== undefined) dbUpdates.apply_url = updates.applyUrl;
    if (updates.active !== undefined) dbUpdates.active = updates.active;

    const supabase = getServerSupabase();
    const { error } = await supabase
      .from('estimate_financing_plans')
      .update(dbUpdates)
      .eq('id', id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Financing] Update error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update plan' },
      { status: 500 }
    );
  }
}
