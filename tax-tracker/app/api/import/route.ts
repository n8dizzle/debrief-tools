import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== 'owner' && !user.permissions?.bpp_tracker?.can_manage_assets) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { assets } = body;

    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return NextResponse.json({ error: 'No assets provided' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // Validate all category_ids exist
    const categoryIds = [...new Set(assets.map((a: any) => a.category_id))];
    const { data: cats } = await supabase
      .from('bpp_categories')
      .select('id')
      .in('id', categoryIds);

    const validCatIds = new Set((cats || []).map(c => c.id));
    const invalidAssets = assets.filter((a: any) => !validCatIds.has(a.category_id));
    if (invalidAssets.length > 0) {
      return NextResponse.json({ error: `Invalid category IDs found in ${invalidAssets.length} assets` }, { status: 400 });
    }

    // Insert all assets
    const insertData = assets.map((a: any) => ({
      category_id: a.category_id,
      description: a.description,
      subcategory: a.subcategory || null,
      quantity: a.quantity || 1,
      unit_cost: a.unit_cost,
      year_acquired: a.year_acquired,
      condition: a.condition || 'good',
      location: a.location || null,
      serial_number: a.serial_number || null,
      notes: a.notes || null,
      created_by: user.id,
    }));

    const { data, error } = await supabase
      .from('bpp_assets')
      .insert(insertData)
      .select();

    if (error) throw error;

    return NextResponse.json({ imported: (data || []).length }, { status: 201 });
  } catch (err: any) {
    console.error('Import error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
