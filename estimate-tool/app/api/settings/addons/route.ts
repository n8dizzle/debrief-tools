import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/settings/addons -- list all cached add-ons
export async function GET() {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('estimate_addons')
      .select('*')
      .eq('active', true)
      .order('popular', { ascending: false })
      .order('name', { ascending: true });

    if (error) throw new Error(error.message);

    const addons = (data || []).map(row => ({
      id: row.id,
      source: row.source,
      stSkuId: row.st_sku_id,
      stCode: row.st_code,
      stType: row.st_type,
      name: row.name,
      description: row.description,
      price: Number(row.price),
      category: row.category,
      popular: row.popular,
      active: row.active,
    }));

    return NextResponse.json({ addons });
  } catch (err) {
    console.error('[Addons] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load add-ons' },
      { status: 500 }
    );
  }
}

// POST /api/settings/addons -- create a manual add-on
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, price, category, popular } = body;

    if (!name || price === undefined) {
      return NextResponse.json({ error: 'Name and price are required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('estimate_addons')
      .insert({
        source: 'manual',
        name,
        description: description || '',
        price,
        category: category || 'other',
        popular: popular || false,
        active: true,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ addon: data });
  } catch (err) {
    console.error('[Addons] Create error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create add-on' },
      { status: 500 }
    );
  }
}
