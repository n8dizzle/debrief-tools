import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getGoogleBusinessClient, AggregatedInsights } from '@/lib/google-business';
import { hasPermission, UserPermissions } from '@/lib/permissions';

/**
 * GET /api/gbp/insights
 * Fetch GBP performance insights for all locations
 *
 * Query params:
 * - period: 7d | 30d | 90d (default: 30d)
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

  // Parse period to days
  const periodDays = period === '7d' ? 7 : period === '90d' ? 90 : 30;

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

    // Calculate date ranges
    const endDate = new Date();
    // Account for 2-3 day data delay from Google
    endDate.setDate(endDate.getDate() - 3);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - periodDays + 1);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

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
        // Build aggregated response from cache
        const insights = buildInsightsFromCache(cachedData, locations, startDateStr, endDateStr);
        return NextResponse.json({
          insights,
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

    const insights = await gbClient.getMultiLocationInsights(locationData, periodDays);

    // Cache the results (background, don't wait)
    cacheInsightsData(supabase, insights, locations).catch(err => {
      console.error('Failed to cache insights:', err);
    });

    return NextResponse.json({
      insights,
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
  endDate: string
): AggregatedInsights {
  // Group by location
  const byLocationMap = new Map<string, {
    viewsMaps: number;
    viewsSearch: number;
    websiteClicks: number;
    phoneCalls: number;
    directionRequests: number;
    bookings: number;
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
  }

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

  const byLocation = locations.map(loc => {
    const data = byLocationMap.get(loc.id) || {
      viewsMaps: 0,
      viewsSearch: 0,
      websiteClicks: 0,
      phoneCalls: 0,
      directionRequests: 0,
      bookings: 0,
    };
    return {
      locationId: loc.id,
      locationName: loc.short_name || loc.name,
      period: { start: startDate, end: endDate },
      viewsMaps: data.viewsMaps,
      viewsSearch: data.viewsSearch,
      totalViews: data.viewsMaps + data.viewsSearch,
      websiteClicks: data.websiteClicks,
      phoneCalls: data.phoneCalls,
      directionRequests: data.directionRequests,
      bookings: data.bookings,
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

  // For previous period, we'd need separate cached data - for now return zeros
  return {
    period: { start: startDate, end: endDate },
    previousPeriod: { start: '', end: '' },
    current,
    previous: {
      totalViews: 0,
      viewsMaps: 0,
      viewsSearch: 0,
      websiteClicks: 0,
      phoneCalls: 0,
      directionRequests: 0,
    },
    byLocation,
  };
}

// Helper: Cache insights data to database
async function cacheInsightsData(
  supabase: ReturnType<typeof getServerSupabase>,
  insights: AggregatedInsights,
  locations: Array<{ id: string }>
): Promise<void> {
  // For each location's daily data, we'd need to upsert
  // Since we only have aggregated data from the API, we'll store the aggregate
  // A more sophisticated implementation would store daily breakdowns

  // For now, we skip detailed caching since the API returns aggregated data
  // A production system would use the daily time series data to cache per-day values
  console.log(`Caching insights for ${locations.length} locations...`);
}
