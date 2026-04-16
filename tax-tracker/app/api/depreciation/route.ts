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

    const { data: categories } = await supabase
      .from('bpp_categories')
      .select('*')
      .order('sort_order');

    const { data: schedules } = await supabase
      .from('bpp_depreciation_schedules')
      .select('*')
      .order('age_years');

    // Group schedules by category
    const result = (categories || []).map(cat => ({
      ...cat,
      schedules: (schedules || []).filter(s => s.category_id === cat.id),
    }));

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Depreciation GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
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
    const { category_id, schedules } = body;

    if (!category_id || !schedules || !Array.isArray(schedules)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // Delete existing schedules for this category
    await supabase
      .from('bpp_depreciation_schedules')
      .delete()
      .eq('category_id', category_id);

    // Insert new schedules
    const insertData = schedules.map((s: any) => ({
      category_id,
      age_years: s.age_years,
      depreciation_percent: s.depreciation_percent,
    }));

    const { error } = await supabase
      .from('bpp_depreciation_schedules')
      .insert(insertData);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Depreciation PUT error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
