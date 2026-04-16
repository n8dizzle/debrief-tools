import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { calculateDepreciatedValue } from '@/lib/depreciation';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const currentYear = new Date().getFullYear();

    // Fetch all active assets with categories
    const { data: assets, error: assetsError } = await supabase
      .from('bpp_assets')
      .select('*, category:bpp_categories(*)')
      .eq('disposed', false)
      .order('created_at', { ascending: false });

    if (assetsError) throw assetsError;

    // Fetch all depreciation schedules
    const { data: schedules, error: schedError } = await supabase
      .from('bpp_depreciation_schedules')
      .select('*');

    if (schedError) throw schedError;

    // Fetch categories
    const { data: categories, error: catError } = await supabase
      .from('bpp_categories')
      .select('*')
      .order('sort_order');

    if (catError) throw catError;

    // Fetch current year rendition
    const { data: rendition } = await supabase
      .from('bpp_renditions')
      .select('*')
      .eq('tax_year', currentYear)
      .maybeSingle();

    // Disposed count
    const { count: disposedCount } = await supabase
      .from('bpp_assets')
      .select('*', { count: 'exact', head: true })
      .eq('disposed', true);

    // Calculate totals per category
    const categoryStats = categories.map(cat => {
      const catAssets = (assets || []).filter(a => a.category_id === cat.id);
      const catSchedules = (schedules || []).filter(s => s.category_id === cat.id);
      const historicalCost = catAssets.reduce((sum, a) => sum + Number(a.total_cost), 0);
      const depreciatedValue = catAssets.reduce((sum, a) => {
        return sum + calculateDepreciatedValue(Number(a.total_cost), a.year_acquired, catSchedules, currentYear);
      }, 0);

      return {
        id: cat.id,
        name: cat.name,
        asset_count: catAssets.length,
        historical_cost: historicalCost,
        depreciated_value: depreciatedValue,
      };
    });

    const totalHistoricalCost = categoryStats.reduce((sum, c) => sum + c.historical_cost, 0);
    const totalDepreciatedValue = categoryStats.reduce((sum, c) => sum + c.depreciated_value, 0);

    return NextResponse.json({
      total_assets: (assets || []).length,
      total_historical_cost: totalHistoricalCost,
      total_depreciated_value: totalDepreciatedValue,
      disposed_count: disposedCount || 0,
      categories: categoryStats,
      recent_assets: (assets || []).slice(0, 5),
      current_rendition: rendition || null,
    });
  } catch (err: any) {
    console.error('Dashboard error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
