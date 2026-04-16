import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();

    const { data: categories, error } = await supabase
      .from('bpp_categories')
      .select('*')
      .order('sort_order');

    if (error) throw error;

    // Get asset counts and totals per category
    const { data: assets } = await supabase
      .from('bpp_assets')
      .select('category_id, total_cost')
      .eq('disposed', false);

    const enriched = (categories || []).map(cat => {
      const catAssets = (assets || []).filter(a => a.category_id === cat.id);
      return {
        ...cat,
        asset_count: catAssets.length,
        total_value: catAssets.reduce((sum, a) => sum + Number(a.total_cost), 0),
      };
    });

    return NextResponse.json(enriched);
  } catch (err: any) {
    console.error('Categories GET error:', err);
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
    if (user.role !== 'owner' && !user.permissions?.bpp_tracker?.can_manage_categories) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, depreciation_type, useful_life_years, sort_order } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('bpp_categories')
      .insert({
        name,
        description: description || null,
        depreciation_type: depreciation_type || 'declining_balance',
        useful_life_years: useful_life_years || 5,
        sort_order: sort_order || 99,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error('Categories POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
