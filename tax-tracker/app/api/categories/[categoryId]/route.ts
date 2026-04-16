import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== 'owner' && !user.permissions?.bpp_tracker?.can_manage_categories) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { categoryId } = await params;
    const body = await request.json();

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('bpp_categories')
      .update({
        name: body.name,
        description: body.description || null,
        depreciation_type: body.depreciation_type,
        useful_life_years: body.useful_life_years,
        sort_order: body.sort_order,
      })
      .eq('id', categoryId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Category PUT error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== 'owner' && !user.permissions?.bpp_tracker?.can_manage_categories) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { categoryId } = await params;
    const supabase = getServerSupabase();

    // Check if category has assets
    const { count } = await supabase
      .from('bpp_assets')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', categoryId);

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category with existing assets. Move or delete assets first.' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('bpp_categories')
      .delete()
      .eq('id', categoryId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Category DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
