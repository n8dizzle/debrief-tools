import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { HuddleHistoricalResponse, HuddleKPIStatus } from '@/lib/supabase';
import { getDateRange } from '@/lib/huddle-utils';

// GET /api/huddle/snapshots - Get historical snapshot data
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const days = parseInt(searchParams.get('days') || '7', 10);

    // If no explicit dates, use last N days
    const dateRange = startDate && endDate
      ? { start: startDate, end: endDate, dates: generateDateRange(startDate, endDate) }
      : getDateRange(days);

    const supabase = getServerSupabase();

    // Fetch departments
    const { data: departments, error: deptError } = await supabase
      .from('huddle_departments')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (deptError) {
      console.error('Error fetching departments:', deptError);
      return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
    }

    // Fetch KPIs
    const { data: kpis, error: kpiError } = await supabase
      .from('huddle_kpis')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (kpiError) {
      console.error('Error fetching KPIs:', kpiError);
      return NextResponse.json({ error: 'Failed to fetch KPIs' }, { status: 500 });
    }

    // Fetch snapshots for date range
    const { data: snapshots, error: snapError } = await supabase
      .from('huddle_snapshots')
      .select('*')
      .gte('snapshot_date', dateRange.start)
      .lte('snapshot_date', dateRange.end);

    if (snapError) {
      console.error('Error fetching snapshots:', snapError);
    }

    // Fetch targets for date range
    const { data: targets, error: targetError } = await supabase
      .from('huddle_targets')
      .select('*')
      .eq('target_type', 'daily')
      .lte('effective_date', dateRange.end)
      .order('effective_date', { ascending: false });

    if (targetError) {
      console.error('Error fetching targets:', targetError);
    }

    // Fetch notes for date range
    const { data: notes, error: notesError } = await supabase
      .from('huddle_notes')
      .select('*')
      .gte('note_date', dateRange.start)
      .lte('note_date', dateRange.end);

    if (notesError) {
      console.error('Error fetching notes:', notesError);
    }

    // Build snapshot lookup: kpi_id -> date -> snapshot
    type SnapshotRecord = {
      id: string;
      kpi_id: string;
      snapshot_date: string;
      actual_value: number | null;
      percent_to_goal: number | null;
      status: string;
      data_source: string | null;
      raw_data: Record<string, unknown>;
      created_at: string;
      updated_at: string;
    };
    const snapshotMap = new Map<string, Map<string, SnapshotRecord>>();
    (snapshots as SnapshotRecord[] | null)?.forEach((s) => {
      if (!snapshotMap.has(s.kpi_id)) {
        snapshotMap.set(s.kpi_id, new Map());
      }
      snapshotMap.get(s.kpi_id)!.set(s.snapshot_date, s);
    });

    // Build target lookup (most recent for each KPI as of end date)
    const targetMap = new Map<string, number>();
    targets?.forEach((t) => {
      if (!targetMap.has(t.kpi_id)) {
        targetMap.set(t.kpi_id, t.target_value);
      }
    });

    // Build notes lookup: kpi_id -> date -> note
    const notesMap = new Map<string, Map<string, string>>();
    notes?.forEach((n) => {
      if (!notesMap.has(n.kpi_id)) {
        notesMap.set(n.kpi_id, new Map());
      }
      notesMap.get(n.kpi_id)!.set(n.note_date, n.note_text || '');
    });

    // Build response
    const response: HuddleHistoricalResponse = {
      start_date: dateRange.start,
      end_date: dateRange.end,
      dates: dateRange.dates,
      departments: departments.map((dept) => ({
        id: dept.id,
        name: dept.name,
        slug: dept.slug,
        kpis: kpis
          .filter((kpi) => kpi.department_id === dept.id)
          .map((kpi) => ({
            id: kpi.id,
            name: kpi.name,
            slug: kpi.slug,
            format: kpi.format,
            unit: kpi.unit,
            values: dateRange.dates.map((date) => {
              const snapshot = snapshotMap.get(kpi.id)?.get(date);
              const note = notesMap.get(kpi.id)?.get(date);
              const target = targetMap.get(kpi.id) || null;

              return {
                kpi_id: kpi.id,
                date,
                actual: snapshot?.actual_value || null,
                target,
                percent_to_goal: snapshot?.percent_to_goal || null,
                status: (snapshot?.status || 'pending') as HuddleKPIStatus,
                note: note || null,
              };
            }),
          })),
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching historical data:', error);
    return NextResponse.json({ error: 'Failed to fetch historical data' }, { status: 500 });
  }
}

// Helper to generate date range
function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');

  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
