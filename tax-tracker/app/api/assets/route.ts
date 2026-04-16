import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const yearFrom = searchParams.get('yearFrom');
    const yearTo = searchParams.get('yearTo');
    const condition = searchParams.get('condition');
    const disposed = searchParams.get('disposed');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortDir = searchParams.get('sortDir') || 'desc';

    const supabase = getServerSupabase();
    let query = supabase
      .from('bpp_assets')
      .select('*, category:bpp_categories(*)');

    // Filters
    if (category) query = query.eq('category_id', category);
    if (yearFrom) query = query.gte('year_acquired', parseInt(yearFrom));
    if (yearTo) query = query.lte('year_acquired', parseInt(yearTo));
    if (condition) query = query.eq('condition', condition);
    if (disposed === 'true') query = query.eq('disposed', true);
    else if (disposed === 'false' || !disposed) query = query.eq('disposed', false);
    if (search) query = query.ilike('description', `%${search}%`);

    // Sorting
    const ascending = sortDir === 'asc';
    query = query.order(sortBy, { ascending });

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error('Assets GET error:', err);
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
    if (user.role !== 'owner' && !user.permissions?.bpp_tracker?.can_manage_assets) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { category_id, description, subcategory, quantity, unit_cost, year_acquired, condition, location, serial_number, notes } = body;

    if (!category_id || !description || !quantity || !unit_cost || !year_acquired) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('bpp_assets')
      .insert({
        category_id,
        description,
        subcategory: subcategory || null,
        quantity,
        unit_cost,
        year_acquired,
        condition: condition || 'good',
        location: location || null,
        serial_number: serial_number || null,
        notes: notes || null,
        created_by: user.id,
      })
      .select('*, category:bpp_categories(*)')
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error('Assets POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
