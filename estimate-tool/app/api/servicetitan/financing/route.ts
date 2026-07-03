import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { ServiceTitanClient } from '@/lib/servicetitan';

export const dynamic = 'force-dynamic';

// GET /api/servicetitan/financing -- attempt to sync financing plans from ST
// Falls back gracefully if the endpoint doesn't exist
export async function GET() {
  try {
    const st = new ServiceTitanClient();

    // Try to fetch financing options from ST settings API
    // This endpoint may not exist -- handle gracefully
    let stPlans: Array<{ id: number; name: string; code?: string; months?: number; apr?: number }> = [];
    let stAvailable = false;

    try {
      stPlans = await st.getFinancingOptions();
      stAvailable = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      // 404 or 403 means the endpoint doesn't exist or we don't have access
      if (msg.includes('404') || msg.includes('403') || msg.includes('Not Found')) {
        return NextResponse.json({
          synced: 0,
          stAvailable: false,
          message: 'ServiceTitan financing endpoint not available. Use manual financing plans instead.',
        });
      }
      throw err;
    }

    if (!stAvailable || stPlans.length === 0) {
      return NextResponse.json({
        synced: 0,
        stAvailable,
        message: stAvailable ? 'No financing plans found in ServiceTitan' : 'ServiceTitan financing endpoint not available',
      });
    }

    // Upsert ST plans into Supabase
    const supabase = getServerSupabase();
    let synced = 0;

    for (const plan of stPlans) {
      const { error } = await supabase
        .from('estimate_financing_plans')
        .upsert(
          {
            source: 'servicetitan',
            st_plan_code: plan.code || String(plan.id),
            name: plan.name,
            months: plan.months || 0,
            apr: plan.apr || 0,
            active: true,
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'st_plan_code', ignoreDuplicates: false }
        );

      if (!error) synced++;
    }

    return NextResponse.json({ synced, stAvailable: true, total: stPlans.length });
  } catch (err) {
    console.error('[ST Financing Sync] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to sync financing from ServiceTitan' },
      { status: 500 }
    );
  }
}
