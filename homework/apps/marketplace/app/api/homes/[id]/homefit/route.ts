import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/homes/[id]/homefit
 * Run HomeFit for a home - returns services matching this home's profile.
 * Calls the `get_homefit_services` database RPC function.
 * Auth required.
 *
 * Query params:
 *   department - filter by department slug
 *   category   - filter by category slug
 *   search     - full-text search query
 *   wave_max   - maximum launch wave to include (1-4)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify home ownership
    const { data: home, error: homeError } = await supabase
      .from('homes')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (homeError || !home) {
      return NextResponse.json({ error: 'Home not found' }, { status: 404 });
    }

    const { searchParams } = request.nextUrl;
    const department = searchParams.get('department');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const waveMax = searchParams.get('wave_max');

    // Build RPC parameters
    const rpcParams: Record<string, unknown> = {
      p_home_id: id,
    };

    if (department) {
      rpcParams.p_department_slug = department;
    }
    if (category) {
      rpcParams.p_category_slug = category;
    }
    if (search) {
      rpcParams.p_search_query = search;
    }
    if (waveMax) {
      const waveNum = parseInt(waveMax, 10);
      if (waveNum >= 1 && waveNum <= 4) {
        rpcParams.p_wave_max = waveNum;
      }
    }

    const { data: services, error } = await supabase.rpc('get_homefit_services', rpcParams);

    if (error) {
      console.error('Error running HomeFit:', error);
      return NextResponse.json({ error: 'Failed to run HomeFit' }, { status: 500 });
    }

    return NextResponse.json({
      home_id: id,
      services: services || [],
      total: (services || []).length,
    });
  } catch (err) {
    console.error('Unexpected error in GET /api/homes/[id]/homefit:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
