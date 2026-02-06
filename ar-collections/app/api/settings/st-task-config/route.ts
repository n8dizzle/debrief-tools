import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

/**
 * GET /api/settings/st-task-config
 * Get cached ST task sources, types, resolutions, and employees
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();

    // Fetch all config tables in parallel
    const [sourcesResult, typesResult, resolutionsResult, employeesResult] = await Promise.all([
      supabase
        .from('ar_st_task_sources')
        .select('*')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('ar_st_task_types')
        .select('*')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('ar_st_task_resolutions')
        .select('*')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('ar_st_employees')
        .select('*')
        .eq('is_active', true)
        .order('name'),
    ]);

    // Get last fetch time
    let lastFetchedAt: string | null = null;
    if (sourcesResult.data && sourcesResult.data.length > 0) {
      lastFetchedAt = sourcesResult.data[0].fetched_at;
    }

    return NextResponse.json({
      sources: sourcesResult.data || [],
      types: typesResult.data || [],
      resolutions: resolutionsResult.data || [],
      employees: employeesResult.data || [],
      lastFetchedAt,
    });
  } catch (error) {
    console.error('ST task config API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
