import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getServiceTitanClient } from '@/lib/servicetitan';

/**
 * POST /api/settings/st-task-config/refresh
 * Fetch fresh task config from ServiceTitan and update cache
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only owners can refresh config
    const role = (session.user as { role?: string }).role;
    if (role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const stClient = getServiceTitanClient();
    if (!stClient.isConfigured()) {
      return NextResponse.json({ error: 'ServiceTitan not configured' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const fetchedAt = new Date().toISOString();

    // Fetch all config from ST
    const [taskData, employees] = await Promise.all([
      stClient.getTaskManagementData(),
      stClient.getEmployees(),
    ]);
    const { sources, types, resolutions } = taskData;

    console.log(`Fetched from ST: ${sources.length} sources, ${types.length} types, ${resolutions.length} resolutions, ${employees.length} employees`);

    // Upsert sources
    if (sources.length > 0) {
      const sourceRecords = sources.map(s => ({
        st_source_id: s.id,
        name: s.name,
        is_active: s.active,
        fetched_at: fetchedAt,
      }));

      const { error: sourcesError } = await supabase
        .from('ar_st_task_sources')
        .upsert(sourceRecords, { onConflict: 'st_source_id' });

      if (sourcesError) {
        console.error('Error upserting sources:', sourcesError);
      }
    }

    // Upsert types
    if (types.length > 0) {
      const typeRecords = types.map(t => ({
        st_type_id: t.id,
        name: t.name,
        is_active: t.active,
        fetched_at: fetchedAt,
      }));

      const { error: typesError } = await supabase
        .from('ar_st_task_types')
        .upsert(typeRecords, { onConflict: 'st_type_id' });

      if (typesError) {
        console.error('Error upserting types:', typesError);
      }
    }

    // Upsert resolutions
    if (resolutions.length > 0) {
      const resolutionRecords = resolutions.map(r => ({
        st_resolution_id: r.id,
        name: r.name,
        is_active: r.active,
        fetched_at: fetchedAt,
      }));

      const { error: resolutionsError } = await supabase
        .from('ar_st_task_resolutions')
        .upsert(resolutionRecords, { onConflict: 'st_resolution_id' });

      if (resolutionsError) {
        console.error('Error upserting resolutions:', resolutionsError);
      }
    }

    // Upsert employees
    if (employees.length > 0) {
      const employeeRecords = employees.map(e => ({
        st_employee_id: e.id,
        name: e.name,
        is_active: e.active,
        fetched_at: fetchedAt,
      }));

      const { error: employeesError } = await supabase
        .from('ar_st_employees')
        .upsert(employeeRecords, { onConflict: 'st_employee_id' });

      if (employeesError) {
        console.error('Error upserting employees:', employeesError);
      }
    }

    // Fetch updated data
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

    return NextResponse.json({
      sources: sourcesResult.data || [],
      types: typesResult.data || [],
      resolutions: resolutionsResult.data || [],
      employees: employeesResult.data || [],
      lastFetchedAt: fetchedAt,
      message: `Refreshed: ${sources.length} sources, ${types.length} types, ${resolutions.length} resolutions, ${employees.length} employees`,
    });
  } catch (error) {
    console.error('ST task config refresh error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
