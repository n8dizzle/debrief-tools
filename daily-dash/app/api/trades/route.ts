import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

interface TradeSnapshot {
  snapshot_date: string;
  trade: string;
  department: string | null;
  revenue: number;
  completed_revenue: number;
  non_job_revenue: number;
  adj_revenue: number;
}

interface DeptRevenue {
  revenue: number;
  completedRevenue: number;
  nonJobRevenue: number;
  adjRevenue: number;
}

interface HVACMetrics extends DeptRevenue {
  departments: {
    install: DeptRevenue;
    service: DeptRevenue;
    maintenance: DeptRevenue;
  };
}

interface TradeMetrics {
  hvac: HVACMetrics;
  plumbing: DeptRevenue;
}

// GET /api/trades - Get trade metrics for a date range
// Query params: startDate, endDate, aggregate (true/false)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate') || startDate;
    const aggregate = searchParams.get('aggregate') === 'true';

    if (!startDate) {
      return NextResponse.json({ error: 'startDate is required' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // Fetch all snapshots in the date range
    const { data: snapshots, error } = await supabase
      .from('trade_daily_snapshots')
      .select('*')
      .gte('snapshot_date', startDate)
      .lte('snapshot_date', endDate)
      .order('snapshot_date');

    if (error) {
      console.error('Error fetching trade snapshots:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const typedSnapshots = snapshots as TradeSnapshot[];

    if (aggregate) {
      // Return aggregated totals for the entire range
      const result = aggregateSnapshots(typedSnapshots);
      return NextResponse.json(result);
    } else {
      // Return daily breakdown
      const byDate: Record<string, TradeMetrics> = {};

      for (const snap of typedSnapshots) {
        if (!byDate[snap.snapshot_date]) {
          byDate[snap.snapshot_date] = createEmptyMetrics();
        }

        applySnapshotToMetrics(byDate[snap.snapshot_date], snap);
      }

      return NextResponse.json({
        startDate,
        endDate,
        dailyMetrics: byDate,
      });
    }
  } catch (error) {
    console.error('Error fetching trade data:', error);
    return NextResponse.json({ error: 'Failed to fetch trade data' }, { status: 500 });
  }
}

function createEmptyMetrics(): TradeMetrics {
  const zeroDept: DeptRevenue = { revenue: 0, completedRevenue: 0, nonJobRevenue: 0, adjRevenue: 0 };
  return {
    hvac: {
      revenue: 0,
      completedRevenue: 0,
      nonJobRevenue: 0,
      adjRevenue: 0,
      departments: {
        install: { ...zeroDept },
        service: { ...zeroDept },
        maintenance: { ...zeroDept },
      },
    },
    plumbing: { ...zeroDept },
  };
}

function applySnapshotToMetrics(metrics: TradeMetrics, snap: TradeSnapshot): void {
  const values: DeptRevenue = {
    revenue: Number(snap.revenue) || 0,
    completedRevenue: Number(snap.completed_revenue) || 0,
    nonJobRevenue: Number(snap.non_job_revenue) || 0,
    adjRevenue: Number(snap.adj_revenue) || 0,
  };

  if (snap.trade === 'hvac') {
    if (snap.department === null) {
      // Aggregate HVAC row
      metrics.hvac.revenue += values.revenue;
      metrics.hvac.completedRevenue += values.completedRevenue;
      metrics.hvac.nonJobRevenue += values.nonJobRevenue;
      metrics.hvac.adjRevenue += values.adjRevenue;
    } else if (snap.department === 'install') {
      metrics.hvac.departments.install.revenue += values.revenue;
      metrics.hvac.departments.install.completedRevenue += values.completedRevenue;
      metrics.hvac.departments.install.nonJobRevenue += values.nonJobRevenue;
      metrics.hvac.departments.install.adjRevenue += values.adjRevenue;
    } else if (snap.department === 'service') {
      metrics.hvac.departments.service.revenue += values.revenue;
      metrics.hvac.departments.service.completedRevenue += values.completedRevenue;
      metrics.hvac.departments.service.nonJobRevenue += values.nonJobRevenue;
      metrics.hvac.departments.service.adjRevenue += values.adjRevenue;
    } else if (snap.department === 'maintenance') {
      metrics.hvac.departments.maintenance.revenue += values.revenue;
      metrics.hvac.departments.maintenance.completedRevenue += values.completedRevenue;
      metrics.hvac.departments.maintenance.nonJobRevenue += values.nonJobRevenue;
      metrics.hvac.departments.maintenance.adjRevenue += values.adjRevenue;
    }
  } else if (snap.trade === 'plumbing') {
    metrics.plumbing.revenue += values.revenue;
    metrics.plumbing.completedRevenue += values.completedRevenue;
    metrics.plumbing.nonJobRevenue += values.nonJobRevenue;
    metrics.plumbing.adjRevenue += values.adjRevenue;
  }
}

function aggregateSnapshots(snapshots: TradeSnapshot[]): TradeMetrics {
  const result = createEmptyMetrics();

  for (const snap of snapshots) {
    applySnapshotToMetrics(result, snap);
  }

  return result;
}
