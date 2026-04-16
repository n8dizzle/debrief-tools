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
    const { data, error } = await supabase
      .from('bpp_renditions')
      .select('*')
      .order('tax_year', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error('Renditions GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== 'owner' && !user.permissions?.bpp_tracker?.can_file_renditions) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { tax_year, county, notes } = body;

    if (!tax_year) {
      return NextResponse.json({ error: 'Tax year is required' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // Compute totals from active assets
    const { data: assets } = await supabase
      .from('bpp_assets')
      .select('total_cost, year_acquired, category_id')
      .eq('disposed', false);

    const { data: schedules } = await supabase
      .from('bpp_depreciation_schedules')
      .select('*');

    const totalHistoricalCost = (assets || []).reduce((sum, a) => sum + Number(a.total_cost), 0);
    const totalMarketValue = (assets || []).reduce((sum, a) => {
      const catSchedules = (schedules || []).filter(s => s.category_id === a.category_id);
      return sum + calculateDepreciatedValue(Number(a.total_cost), a.year_acquired, catSchedules, tax_year);
    }, 0);

    const { data, error } = await supabase
      .from('bpp_renditions')
      .insert({
        tax_year,
        county: county || 'Harris',
        due_date: `${tax_year}-04-15`,
        total_historical_cost: totalHistoricalCost,
        total_market_value: totalMarketValue,
        notes: notes || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error('Renditions POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
