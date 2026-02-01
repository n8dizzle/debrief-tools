import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getGoogleBusinessClient, AggregatedInsights } from '@/lib/google-business';
import { hasPermission, UserPermissions } from '@/lib/permissions';
import { getSTMetricsForLocations, STLocationMetrics } from '@/lib/st-metrics';

/**
 * GET /api/gbp/insights
 * Fetch GBP performance insights for all locations
 *
 * Query params:
 * - period: 7d | 30d | 90d (default: 30d) - OR use start/end dates
 * - start: Start date (YYYY-MM-DD)
 * - end: End date (YYYY-MM-DD)
 * - refresh: true - Force refresh from Google API (ignores cache)
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

  // Check for any marketing_hub permission
  const hasAccess =
    hasPermission(role, permissions, 'marketing_hub', 'can_manage_gbp_posts') ||
    hasPermission(role, permissions, 'marketing_hub', 'can_view_analytics');

  if (!hasAccess) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '30d';
  const forceRefresh = searchParams.get('refresh') === 'true';
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  const supabase = getServerSupabase();
  const gbClient = getGoogleBusinessClient();

  if (!gbClient.isConfigured()) {
    return NextResponse.json(
      { error: 'Google Business Profile not configured' },
      { status: 503 }
    );
  }

  try {
    // Get all configured locations
    const { data: locations, error: locError } = await supabase
      .from('google_locations')
      .select('*')
      .not('google_account_id', 'is', null)
      .not('google_location_id', 'is', null)
      .order('display_order');

    if (locError) {
      console.error('Failed to fetch locations:', locError);
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }

    if (!locations || locations.length === 0) {
      return NextResponse.json({
        insights: {
          period: { start: '', end: '' },
          previousPeriod: { start: '', end: '' },
          current: {
            totalViews: 0,
            viewsMaps: 0,
            viewsSearch: 0,
            websiteClicks: 0,
            phoneCalls: 0,
            directionRequests: 0,
          },
          previous: {
            totalViews: 0,
            viewsMaps: 0,
            viewsSearch: 0,
            websiteClicks: 0,
            phoneCalls: 0,
            directionRequests: 0,
          },
          byLocation: [],
        },
        cached: false,
        locationCount: 0,
      });
    }

    // Calculate date ranges - use start/end params if provided, otherwise use period
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    let startDateStr: string;
    let endDateStr: string;
    let periodDays: number;

    if (startParam && endParam) {
      // Use provided date range
      startDateStr = startParam;
      endDateStr = endParam;
      periodDays = Math.ceil(
        (new Date(endParam).getTime() - new Date(startParam).getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
    } else {
      // Use period-based calculation
      periodDays = period === '7d' ? 7 : period === '90d' ? 90 : 30;
      const endDate = new Date();
      // Account for 2-3 day data delay from Google
      endDate.setDate(endDate.getDate() - 3);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - periodDays + 1);
      startDateStr = formatDate(startDate);
      endDateStr = formatDate(endDate);
    }

    // Calculate YoY date range (same period, previous year)
    const yoyStartDate = new Date(startDateStr + 'T00:00:00');
    yoyStartDate.setFullYear(yoyStartDate.getFullYear() - 1);
    const yoyEndDate = new Date(endDateStr + 'T00:00:00');
    yoyEndDate.setFullYear(yoyEndDate.getFullYear() - 1);
    const yoyStartStr = formatDate(yoyStartDate);
    const yoyEndStr = formatDate(yoyEndDate);

    // Calculate YTD range (Jan 1 of current year to end date)
    const ytdStart = `${new Date(endDateStr).getFullYear()}-01-01`;
    const ytdEnd = endDateStr;

    // Always fetch YoY and YTD data from cache (we have 18 months of history)
    const [yoyResult, ytdResult] = await Promise.all([
      supabase
        .from('gbp_insights_cache')
        .select('location_id, views_maps, views_search, website_clicks, phone_calls, direction_requests')
        .gte('date', yoyStartStr)
        .lte('date', yoyEndStr),
      supabase
        .from('gbp_insights_cache')
        .select('location_id, views_maps, views_search, website_clicks, phone_calls, direction_requests')
        .gte('date', ytdStart)
        .lte('date', ytdEnd),
    ]);

    const yoyData = yoyResult.data || [];
    const ytdData = ytdResult.data || [];

    // Fetch ST metrics for locations with campaign names (in parallel with cache check)
    const stMetricsPromise = getSTMetricsForLocations(
      locations.map(loc => ({ id: loc.id, st_campaign_name: loc.st_campaign_name })),
      startDateStr,
      endDateStr
    );

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const { data: cachedData } = await supabase
        .from('gbp_insights_cache')
        .select('*, location:google_locations(*)')
        .gte('date', startDateStr)
        .lte('date', endDateStr);

      // If we have cached data covering most of the period, use it
      const expectedDays = periodDays * locations.length;
      if (cachedData && cachedData.length >= expectedDays * 0.8) {
        // Build aggregated response from cache with YoY and YTD
        const insights = buildInsightsFromCache(
          cachedData,
          locations,
          startDateStr,
          endDateStr,
          yoyData,
          ytdData
        );

        // Merge ST metrics into the insights
        const stMetrics = await stMetricsPromise;
        const insightsWithST = mergeSTMetrics(insights, stMetrics);

        return NextResponse.json({
          insights: insightsWithST,
          cached: true,
          locationCount: locations.length,
        });
      }
    }

    // Fetch fresh data from Google API
    const locationData = locations.map(loc => ({
      id: loc.id,
      name: loc.short_name || loc.name,
      google_location_id: loc.google_location_id,
    }));

    const freshInsights = await gbClient.getMultiLocationInsights(locationData, periodDays);

    // Merge YoY and YTD data into the fresh insights
    const insightsWithComparisons = addComparisonData(freshInsights, locations, yoyData, ytdData);

    // Merge ST metrics into the insights
    const stMetrics = await stMetricsPromise;
    const insightsWithST = mergeSTMetrics(insightsWithComparisons, stMetrics);

    // Cache the results (background, don't wait)
    cacheInsightsData(supabase, freshInsights, locations, startDateStr, endDateStr).catch(err => {
      console.error('Failed to cache insights:', err);
    });

    return NextResponse.json({
      insights: insightsWithST,
      cached: false,
      locationCount: locations.length,
    });
  } catch (error) {
    console.error('Failed to fetch GBP insights:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gbp/insights/sync
 * Force sync insights data from Google API
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role, permissions } = session.user as {
    role: 'employee' | 'manager' | 'owner';
    permissions: UserPermissions | null;
  };

  if (!hasPermission(role, permissions, 'marketing_hub', 'can_sync_data')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  // Redirect to GET with refresh=true
  const url = new URL(request.url);
  url.searchParams.set('refresh', 'true');

  // Call GET internally
  return GET(new NextRequest(url.toString(), { method: 'GET', headers: request.headers }));
}

// Helper: Calculate YoY percentage change
function calcYoYChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

// Helper: Add YoY and YTD comparison data to fresh API insights
function addComparisonData(
  insights: AggregatedInsights,
  locations: Array<{ id: string; name: string; short_name: string }>,
  yoyData: Array<{
    location_id: string;
    views_maps: number;
    views_search: number;
    website_clicks: number;
    phone_calls: number;
    direction_requests: number;
  }>,
  ytdData: Array<{
    location_id: string;
    views_maps: number;
    views_search: number;
    website_clicks: number;
    phone_calls: number;
    direction_requests: number;
  }>
): AggregatedInsights {
  // Aggregate YoY data by location
  const yoyByLocation = new Map<string, {
    viewsMaps: number;
    viewsSearch: number;
    websiteClicks: number;
    phoneCalls: number;
    directionRequests: number;
  }>();

  // Aggregate YTD data by location
  const ytdByLocation = new Map<string, {
    viewsMaps: number;
    viewsSearch: number;
    websiteClicks: number;
    phoneCalls: number;
    directionRequests: number;
  }>();

  for (const loc of locations) {
    yoyByLocation.set(loc.id, {
      viewsMaps: 0,
      viewsSearch: 0,
      websiteClicks: 0,
      phoneCalls: 0,
      directionRequests: 0,
    });
    ytdByLocation.set(loc.id, {
      viewsMaps: 0,
      viewsSearch: 0,
      websiteClicks: 0,
      phoneCalls: 0,
      directionRequests: 0,
    });
  }

  for (const row of yoyData) {
    const existing = yoyByLocation.get(row.location_id);
    if (existing) {
      existing.viewsMaps += row.views_maps || 0;
      existing.viewsSearch += row.views_search || 0;
      existing.websiteClicks += row.website_clicks || 0;
      existing.phoneCalls += row.phone_calls || 0;
      existing.directionRequests += row.direction_requests || 0;
    }
  }

  for (const row of ytdData) {
    const existing = ytdByLocation.get(row.location_id);
    if (existing) {
      existing.viewsMaps += row.views_maps || 0;
      existing.viewsSearch += row.views_search || 0;
      existing.websiteClicks += row.website_clicks || 0;
      existing.phoneCalls += row.phone_calls || 0;
      existing.directionRequests += row.direction_requests || 0;
    }
  }

  // Add comparison data to each location
  const byLocationWithComparisons = insights.byLocation.map(loc => {
    const yoy = yoyByLocation.get(loc.locationId) || {
      viewsMaps: 0,
      viewsSearch: 0,
      websiteClicks: 0,
      phoneCalls: 0,
      directionRequests: 0,
    };
    const ytd = ytdByLocation.get(loc.locationId) || {
      viewsMaps: 0,
      viewsSearch: 0,
      websiteClicks: 0,
      phoneCalls: 0,
      directionRequests: 0,
    };

    const yoyViews = yoy.viewsMaps + yoy.viewsSearch;

    return {
      ...loc,
      callsYoY: calcYoYChange(loc.phoneCalls, yoy.phoneCalls),
      viewsYoY: calcYoYChange(loc.totalViews, yoyViews),
      clicksYoY: calcYoYChange(loc.websiteClicks, yoy.websiteClicks),
      directionsYoY: calcYoYChange(loc.directionRequests, yoy.directionRequests),
      ytdCalls: ytd.phoneCalls,
      ytdViews: ytd.viewsMaps + ytd.viewsSearch,
      ytdClicks: ytd.websiteClicks,
      ytdDirections: ytd.directionRequests,
    };
  });

  // Calculate YoY totals for previous period
  type TotalsType = { totalViews: number; viewsMaps: number; viewsSearch: number; websiteClicks: number; phoneCalls: number; directionRequests: number };
  const yoyTotals = Array.from(yoyByLocation.values()).reduce<TotalsType>(
    (acc, loc) => ({
      totalViews: acc.totalViews + loc.viewsMaps + loc.viewsSearch,
      viewsMaps: acc.viewsMaps + loc.viewsMaps,
      viewsSearch: acc.viewsSearch + loc.viewsSearch,
      websiteClicks: acc.websiteClicks + loc.websiteClicks,
      phoneCalls: acc.phoneCalls + loc.phoneCalls,
      directionRequests: acc.directionRequests + loc.directionRequests,
    }),
    { totalViews: 0, viewsMaps: 0, viewsSearch: 0, websiteClicks: 0, phoneCalls: 0, directionRequests: 0 }
  );

  return {
    ...insights,
    previous: yoyTotals,
    byLocation: byLocationWithComparisons,
  };
}

// Helper: Build insights from cached data
function buildInsightsFromCache(
  cachedData: Array<{
    location_id: string;
    date: string;
    views_maps: number;
    views_search: number;
    website_clicks: number;
    phone_calls: number;
    direction_requests: number;
    bookings: number;
    location?: { id: string; name: string; short_name: string };
  }>,
  locations: Array<{ id: string; name: string; short_name: string }>,
  startDate: string,
  endDate: string,
  yoyData: Array<{
    location_id: string;
    views_maps: number;
    views_search: number;
    website_clicks: number;
    phone_calls: number;
    direction_requests: number;
  }>,
  ytdData: Array<{
    location_id: string;
    views_maps: number;
    views_search: number;
    website_clicks: number;
    phone_calls: number;
    direction_requests: number;
  }>
): AggregatedInsights {
  // Group current period by location
  const byLocationMap = new Map<string, {
    viewsMaps: number;
    viewsSearch: number;
    websiteClicks: number;
    phoneCalls: number;
    directionRequests: number;
    bookings: number;
  }>();

  // Group YoY data by location
  const yoyByLocation = new Map<string, {
    viewsMaps: number;
    viewsSearch: number;
    websiteClicks: number;
    phoneCalls: number;
    directionRequests: number;
  }>();

  // Group YTD data by location
  const ytdByLocation = new Map<string, {
    viewsMaps: number;
    viewsSearch: number;
    websiteClicks: number;
    phoneCalls: number;
    directionRequests: number;
  }>();

  for (const loc of locations) {
    byLocationMap.set(loc.id, {
      viewsMaps: 0,
      viewsSearch: 0,
      websiteClicks: 0,
      phoneCalls: 0,
      directionRequests: 0,
      bookings: 0,
    });
    yoyByLocation.set(loc.id, {
      viewsMaps: 0,
      viewsSearch: 0,
      websiteClicks: 0,
      phoneCalls: 0,
      directionRequests: 0,
    });
    ytdByLocation.set(loc.id, {
      viewsMaps: 0,
      viewsSearch: 0,
      websiteClicks: 0,
      phoneCalls: 0,
      directionRequests: 0,
    });
  }

  // Aggregate current period
  for (const row of cachedData) {
    const existing = byLocationMap.get(row.location_id);
    if (existing) {
      existing.viewsMaps += row.views_maps || 0;
      existing.viewsSearch += row.views_search || 0;
      existing.websiteClicks += row.website_clicks || 0;
      existing.phoneCalls += row.phone_calls || 0;
      existing.directionRequests += row.direction_requests || 0;
      existing.bookings += row.bookings || 0;
    }
  }

  // Aggregate YoY data
  for (const row of yoyData) {
    const existing = yoyByLocation.get(row.location_id);
    if (existing) {
      existing.viewsMaps += row.views_maps || 0;
      existing.viewsSearch += row.views_search || 0;
      existing.websiteClicks += row.website_clicks || 0;
      existing.phoneCalls += row.phone_calls || 0;
      existing.directionRequests += row.direction_requests || 0;
    }
  }

  // Aggregate YTD data
  for (const row of ytdData) {
    const existing = ytdByLocation.get(row.location_id);
    if (existing) {
      existing.viewsMaps += row.views_maps || 0;
      existing.viewsSearch += row.views_search || 0;
      existing.websiteClicks += row.website_clicks || 0;
      existing.phoneCalls += row.phone_calls || 0;
      existing.directionRequests += row.direction_requests || 0;
    }
  }

  const byLocation = locations.map(loc => {
    const data = byLocationMap.get(loc.id) || {
      viewsMaps: 0,
      viewsSearch: 0,
      websiteClicks: 0,
      phoneCalls: 0,
      directionRequests: 0,
      bookings: 0,
    };
    const yoy = yoyByLocation.get(loc.id) || {
      viewsMaps: 0,
      viewsSearch: 0,
      websiteClicks: 0,
      phoneCalls: 0,
      directionRequests: 0,
    };
    const ytd = ytdByLocation.get(loc.id) || {
      viewsMaps: 0,
      viewsSearch: 0,
      websiteClicks: 0,
      phoneCalls: 0,
      directionRequests: 0,
    };

    const currentViews = data.viewsMaps + data.viewsSearch;
    const yoyViews = yoy.viewsMaps + yoy.viewsSearch;

    return {
      locationId: loc.id,
      locationName: loc.short_name || loc.name,
      period: { start: startDate, end: endDate },
      viewsMaps: data.viewsMaps,
      viewsSearch: data.viewsSearch,
      totalViews: currentViews,
      websiteClicks: data.websiteClicks,
      phoneCalls: data.phoneCalls,
      directionRequests: data.directionRequests,
      bookings: data.bookings,
      // YoY percentage changes
      callsYoY: calcYoYChange(data.phoneCalls, yoy.phoneCalls),
      viewsYoY: calcYoYChange(currentViews, yoyViews),
      clicksYoY: calcYoYChange(data.websiteClicks, yoy.websiteClicks),
      directionsYoY: calcYoYChange(data.directionRequests, yoy.directionRequests),
      // YTD totals
      ytdCalls: ytd.phoneCalls,
      ytdViews: ytd.viewsMaps + ytd.viewsSearch,
      ytdClicks: ytd.websiteClicks,
      ytdDirections: ytd.directionRequests,
    };
  });

  const current = byLocation.reduce(
    (acc, loc) => ({
      totalViews: acc.totalViews + loc.totalViews,
      viewsMaps: acc.viewsMaps + loc.viewsMaps,
      viewsSearch: acc.viewsSearch + loc.viewsSearch,
      websiteClicks: acc.websiteClicks + loc.websiteClicks,
      phoneCalls: acc.phoneCalls + loc.phoneCalls,
      directionRequests: acc.directionRequests + loc.directionRequests,
    }),
    { totalViews: 0, viewsMaps: 0, viewsSearch: 0, websiteClicks: 0, phoneCalls: 0, directionRequests: 0 }
  );

  // Calculate YoY totals for previous period comparison
  type TotalsType = { totalViews: number; viewsMaps: number; viewsSearch: number; websiteClicks: number; phoneCalls: number; directionRequests: number };
  const yoyTotals = Array.from(yoyByLocation.values()).reduce<TotalsType>(
    (acc, loc) => ({
      totalViews: acc.totalViews + loc.viewsMaps + loc.viewsSearch,
      viewsMaps: acc.viewsMaps + loc.viewsMaps,
      viewsSearch: acc.viewsSearch + loc.viewsSearch,
      websiteClicks: acc.websiteClicks + loc.websiteClicks,
      phoneCalls: acc.phoneCalls + loc.phoneCalls,
      directionRequests: acc.directionRequests + loc.directionRequests,
    }),
    { totalViews: 0, viewsMaps: 0, viewsSearch: 0, websiteClicks: 0, phoneCalls: 0, directionRequests: 0 }
  );

  return {
    period: { start: startDate, end: endDate },
    previousPeriod: { start: '', end: '' },
    current,
    previous: yoyTotals, // Use YoY data as previous for the stat cards
    byLocation,
  };
}

// Helper: Merge ServiceTitan metrics into GBP insights
function mergeSTMetrics(
  insights: AggregatedInsights,
  stMetrics: Map<string, STLocationMetrics>
): AggregatedInsights & { hasSTData: boolean; stTotals: { stCallsBooked: number; stCallsTotal: number; stRevenue: number; stJobCount: number } } {
  // Check if any location has ST data
  const hasSTData = stMetrics.size > 0;

  // Merge ST data into each location
  const byLocationWithST = insights.byLocation.map(loc => {
    const stData = stMetrics.get(loc.locationId);
    return {
      ...loc,
      // ST metrics (null if no campaign name configured)
      stCallsBooked: stData?.callsBooked ?? null,
      stCallsTotal: stData?.callsTotal ?? null,
      stRevenue: stData?.revenue ?? null,
      stAvgTicket: stData?.avgTicket ?? null,
      stJobCount: stData?.jobCount ?? null,
      hasSTCampaign: stData !== undefined,
    };
  });

  // Calculate ST totals
  const stTotals = {
    stCallsBooked: 0,
    stCallsTotal: 0,
    stRevenue: 0,
    stJobCount: 0,
  };

  for (const loc of byLocationWithST) {
    stTotals.stCallsBooked += loc.stCallsBooked || 0;
    stTotals.stCallsTotal += loc.stCallsTotal || 0;
    stTotals.stRevenue += loc.stRevenue || 0;
    stTotals.stJobCount += loc.stJobCount || 0;
  }

  return {
    ...insights,
    byLocation: byLocationWithST,
    hasSTData,
    stTotals,
  };
}

// Helper: Cache insights data to database
// Note: This caches aggregate data per location for the queried period.
// For proper daily caching, use the /api/gbp/insights/sync endpoint which
// fetches raw daily time series data from the Google API.
async function cacheInsightsData(
  supabase: ReturnType<typeof getServerSupabase>,
  insights: AggregatedInsights,
  locations: Array<{ id: string; google_location_id: string; short_name?: string; name: string }>,
  startDate: string,
  endDate: string
): Promise<void> {
  // The getMultiLocationInsights function only returns aggregated totals,
  // not daily breakdowns. To properly cache daily data, we need to call
  // getLocationInsights for each location and parse the time series.
  //
  // For now, trigger a background sync to populate daily data:
  console.log(`[GBP Cache] Triggering background sync for ${locations.length} locations...`);

  // Fetch the CRON_SECRET from env to call the sync endpoint
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn('[GBP Cache] CRON_SECRET not configured, skipping background sync');
    return;
  }

  // Get base URL from env or construct from request
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3002';

  try {
    // Call the sync endpoint in the background
    const response = await fetch(`${baseUrl}/api/gbp/insights/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[GBP Cache] Background sync failed:', error);
    } else {
      const result = await response.json();
      console.log(`[GBP Cache] Background sync complete: ${result.total_rows_upserted} rows upserted`);
    }
  } catch (err) {
    console.error('[GBP Cache] Background sync error:', err);
  }
}
