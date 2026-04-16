import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assetId } = await params;
    const supabase = getServerSupabase();

    const { data, error } = await supabase
      .from('bpp_assets')
      .select('*, category:bpp_categories(*)')
      .eq('id', assetId)
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Fetch depreciation schedule for this category
    const { data: schedules } = await supabase
      .from('bpp_depreciation_schedules')
      .select('*')
      .eq('category_id', data.category_id)
      .order('age_years');

    return NextResponse.json({ ...data, depreciation_schedules: schedules || [] });
  } catch (err: any) {
    console.error('Asset GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== 'owner' && !user.permissions?.bpp_tracker?.can_manage_assets) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { assetId } = await params;
    const body = await request.json();
    const { category_id, description, subcategory, quantity, unit_cost, year_acquired, condition, location, serial_number, notes, disposed, disposed_date } = body;

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('bpp_assets')
      .update({
        category_id,
        description,
        subcategory: subcategory || null,
        quantity,
        unit_cost,
        year_acquired,
        condition,
        location: location || null,
        serial_number: serial_number || null,
        notes: notes || null,
        disposed: disposed || false,
        disposed_date: disposed_date || null,
      })
      .eq('id', assetId)
      .select('*, category:bpp_categories(*)')
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Asset PUT error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== 'owner' && !user.permissions?.bpp_tracker?.can_manage_assets) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { assetId } = await params;
    const supabase = getServerSupabase();

    const { error } = await supabase
      .from('bpp_assets')
      .delete()
      .eq('id', assetId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Asset DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
