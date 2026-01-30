import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasPermission, UserPermissions } from '@/lib/permissions';

/**
 * GET /api/gbp/insights/daily
 * Fetch daily GBP metrics from cache for charting
 *
 * Query params:
 * - start: Start date (YYYY-MM-DD)
 * - end: End date (YYYY-MM-DD)
 * - metric: views | calls | clicks | directions (default: views)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role, permissions } = session.user as {
    role: 'employee' | 'manager' | 'owner';
    permissions: UserPermissions | null;
  };

  const hasAccess =
    hasPermission(role, permissions, 'marketing_hub', 'can_manage_gbp_posts') ||
    hasPermission(role, permissions, 'marketing_hub', 'can_view_analytics');

  if (!hasAccess) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'start and end dates are required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  try {
    // Fetch daily data from cache
    const { data: dailyData, error } = await supabase
      .from('gbp_insights_cache')
      .select('date, views_maps, views_search, website_clicks, phone_calls, direction_requests, location:google_locations(short_name)')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      console.error('Failed to fetch daily data:', error);
      return NextResponse.json({ error: 'Failed to fetch daily data' }, { status: 500 });
    }

    // Aggregate by date (sum all locations per day) with per-location breakdown
    interface LocationBreakdown {
      name: string;
      views: number;
      clicks: number;
      calls: number;
      directions: number;
    }

    interface DailyEntry {
      date: string;
      views: number;
      viewsMaps: number;
      viewsSearch: number;
      clicks: number;
      calls: number;
      directions: number;
      byLocation: LocationBreakdown[];
    }

    const byDate = new Map<string, DailyEntry>();

    for (const row of dailyData || []) {
      // Supabase returns location as object (not array) for single foreign key joins
      const locationData = row.location as { short_name: string } | { short_name: string }[] | null;
      const locationName = Array.isArray(locationData)
        ? locationData[0]?.short_name || 'Unknown'
        : locationData?.short_name || 'Unknown';

      const existing: DailyEntry = byDate.get(row.date) || {
        date: row.date,
        views: 0,
        viewsMaps: 0,
        viewsSearch: 0,
        clicks: 0,
        calls: 0,
        directions: 0,
        byLocation: [] as LocationBreakdown[],
      };

      const rowViews = (row.views_maps || 0) + (row.views_search || 0);
      const rowClicks = row.website_clicks || 0;
      const rowCalls = row.phone_calls || 0;
      const rowDirections = row.direction_requests || 0;

      existing.views += rowViews;
      existing.viewsMaps += row.views_maps || 0;
      existing.viewsSearch += row.views_search || 0;
      existing.clicks += rowClicks;
      existing.calls += rowCalls;
      existing.directions += rowDirections;

      // Add location breakdown (only if there's any data)
      if (rowViews > 0 || rowClicks > 0 || rowCalls > 0 || rowDirections > 0) {
        existing.byLocation.push({
          name: locationName,
          views: rowViews,
          clicks: rowClicks,
          calls: rowCalls,
          directions: rowDirections,
        });
      }

      byDate.set(row.date, existing);
    }

    // Sort byLocation within each day by views descending
    const daily = Array.from(byDate.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        byLocation: d.byLocation.sort((a, b) => b.views - a.views),
      }));

    // Calculate totals
    const totals = daily.reduce(
      (acc, d) => ({
        views: acc.views + d.views,
        clicks: acc.clicks + d.clicks,
        calls: acc.calls + d.calls,
        directions: acc.directions + d.directions,
      }),
      { views: 0, clicks: 0, calls: 0, directions: 0 }
    );

    const avgPerDay = daily.length > 0 ? {
      views: Math.round(totals.views / daily.length * 10) / 10,
      clicks: Math.round(totals.clicks / daily.length * 10) / 10,
      calls: Math.round(totals.calls / daily.length * 10) / 10,
      directions: Math.round(totals.directions / daily.length * 10) / 10,
    } : { views: 0, clicks: 0, calls: 0, directions: 0 };

    return NextResponse.json({
      daily,
      totals,
      avgPerDay,
      dateRange: { start: startDate, end: endDate },
      daysCount: daily.length,
    });
  } catch (error) {
    console.error('Failed to fetch daily insights:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch daily insights' },
      { status: 500 }
    );
  }
}
