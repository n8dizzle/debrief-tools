import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { calculateDepreciatedValue } from '@/lib/depreciation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ renditionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { renditionId } = await params;
    const supabase = getServerSupabase();

    const { data: rendition, error } = await supabase
      .from('bpp_renditions')
      .select('*')
      .eq('id', renditionId)
      .single();

    if (error) throw error;
    if (!rendition) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Build rendition summary grouped by category
    const { data: assets } = await supabase
      .from('bpp_assets')
      .select('*, category:bpp_categories(*)')
      .eq('disposed', false)
      .order('year_acquired');

    const { data: schedules } = await supabase
      .from('bpp_depreciation_schedules')
      .select('*');

    const { data: categories } = await supabase
      .from('bpp_categories')
      .select('*')
      .order('sort_order');

    // Group by category, then by year_acquired
    const summary = (categories || []).map(cat => {
      const catAssets = (assets || []).filter(a => a.category_id === cat.id);
      const catSchedules = (schedules || []).filter(s => s.category_id === cat.id);

      // Group by year
      const byYear: Record<number, { count: number; historical_cost: number; depreciated_value: number }> = {};
      for (const asset of catAssets) {
        const yr = asset.year_acquired;
        if (!byYear[yr]) byYear[yr] = { count: 0, historical_cost: 0, depreciated_value: 0 };
        byYear[yr].count += asset.quantity;
        byYear[yr].historical_cost += Number(asset.total_cost);
        byYear[yr].depreciated_value += calculateDepreciatedValue(
          Number(asset.total_cost), asset.year_acquired, catSchedules, rendition.tax_year
        );
      }

      const items = Object.entries(byYear)
        .map(([yr, data]) => ({ year_acquired: parseInt(yr), ...data }))
        .sort((a, b) => a.year_acquired - b.year_acquired);

      return {
        category_id: cat.id,
        category_name: cat.name,
        items,
        total_historical_cost: items.reduce((sum, i) => sum + i.historical_cost, 0),
        total_depreciated_value: items.reduce((sum, i) => sum + i.depreciated_value, 0),
      };
    }).filter(s => s.items.length > 0);

    return NextResponse.json({ ...rendition, summary });
  } catch (err: any) {
    console.error('Rendition GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ renditionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== 'owner' && !user.permissions?.bpp_tracker?.can_file_renditions) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { renditionId } = await params;
    const body = await request.json();

    const supabase = getServerSupabase();

    // If marking as filed, recalculate totals
    let updateData: any = {
      status: body.status,
      notes: body.notes,
      extension_filed: body.extension_filed,
      extension_date: body.extension_date || null,
    };

    if (body.status === 'filed' && body.filed_date) {
      updateData.filed_date = body.filed_date;

      // Recalculate totals
      const { data: assets } = await supabase
        .from('bpp_assets')
        .select('total_cost, year_acquired, category_id')
        .eq('disposed', false);

      const { data: schedules } = await supabase
        .from('bpp_depreciation_schedules')
        .select('*');

      const { data: rendition } = await supabase
        .from('bpp_renditions')
        .select('tax_year')
        .eq('id', renditionId)
        .single();

      if (rendition) {
        updateData.total_historical_cost = (assets || []).reduce((sum, a) => sum + Number(a.total_cost), 0);
        updateData.total_market_value = (assets || []).reduce((sum, a) => {
          const catSchedules = (schedules || []).filter(s => s.category_id === a.category_id);
          return sum + calculateDepreciatedValue(Number(a.total_cost), a.year_acquired, catSchedules, rendition.tax_year);
        }, 0);
      }
    }

    const { data, error } = await supabase
      .from('bpp_renditions')
      .update(updateData)
      .eq('id', renditionId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Rendition PUT error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
