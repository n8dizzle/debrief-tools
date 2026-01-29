import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getGoogleBusinessClient, DailyMetricTimeSeries } from '@/lib/google-business';
import { hasPermission, UserPermissions } from '@/lib/permissions';

interface SyncResult {
  location_id: string;
  location_name: string;
  rows_upserted: number;
  error?: string;
}

/**
 * POST /api/gbp/insights/sync
 * Sync GBP performance data from Google API to Supabase cache
 *
 * Auth: CRON_SECRET header (for cron jobs) OR session with can_sync_data permission
 *
 * This endpoint:
 * 1. Fetches last 7 days of data from Google Business Profile Performance API
 * 2. Upserts daily metrics per location into gbp_insights_cache
 * 3. Returns sync summary
 */
export async function POST(request: NextRequest) {
  // Auth check: cron secret OR session
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCronAuth) {
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
  }

  const syncSource = isCronAuth ? 'cron' : 'manual';
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
      console.error('[GBP Sync] Failed to fetch locations:', locError);
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }

    if (!locations || locations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No locations configured',
        sync_source: syncSource,
        results: [],
      });
    }

    // Calculate date range: last 7 days (accounts for 3-day delay)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 3); // Account for Google's data delay
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6); // 7 days total

    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    console.log(`[GBP Sync] Syncing ${locations.length} locations from ${startDateStr} to ${endDateStr}`);

    const results: SyncResult[] = [];

    // Process each location
    for (const location of locations) {
      const result: SyncResult = {
        location_id: location.id,
        location_name: location.short_name || location.name,
        rows_upserted: 0,
      };

      try {
        // Fetch insights from Google API
        const insights = await gbClient.getLocationInsights(
          location.google_location_id,
          startDateStr,
          endDateStr
        );

        if (!insights.multiDailyMetricTimeSeries) {
          result.error = 'No time series data returned';
          results.push(result);
          continue;
        }

        // Build daily records from time series
        const dailyRecords = buildDailyRecords(
          insights.multiDailyMetricTimeSeries,
          location.id
        );

        if (dailyRecords.length === 0) {
          result.error = 'No daily data to upsert';
          results.push(result);
          continue;
        }

        // Upsert to database
        const { error: upsertError } = await supabase
          .from('gbp_insights_cache')
          .upsert(dailyRecords, {
            onConflict: 'location_id,date',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error(`[GBP Sync] Upsert error for ${location.short_name}:`, upsertError);
          result.error = upsertError.message;
        } else {
          result.rows_upserted = dailyRecords.length;
        }
      } catch (err) {
        console.error(`[GBP Sync] Error processing ${location.short_name}:`, err);
        result.error = err instanceof Error ? err.message : 'Unknown error';
      }

      results.push(result);
    }

    const totalRows = results.reduce((sum, r) => sum + r.rows_upserted, 0);
    const errors = results.filter(r => r.error).length;

    console.log(`[GBP Sync] Complete: ${totalRows} rows upserted, ${errors} errors`);

    return NextResponse.json({
      success: true,
      sync_source: syncSource,
      date_range: { start: startDateStr, end: endDateStr },
      locations_processed: locations.length,
      total_rows_upserted: totalRows,
      errors_count: errors,
      results,
    });
  } catch (error) {
    console.error('[GBP Sync] Fatal error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

/**
 * Build daily records from Google API time series data
 * Combines desktop+mobile impressions into views_maps and views_search
 */
function buildDailyRecords(
  timeSeries: DailyMetricTimeSeries[],
  locationId: string
): Array<{
  location_id: string;
  date: string;
  views_maps: number;
  views_search: number;
  website_clicks: number;
  phone_calls: number;
  direction_requests: number;
  bookings: number;
  fetched_at: string;
}> {
  // Build a map of date -> metrics
  const dateMap = new Map<string, {
    mapsDesktop: number;
    mapsMobile: number;
    searchDesktop: number;
    searchMobile: number;
    websiteClicks: number;
    phoneCalls: number;
    directionRequests: number;
  }>();

  for (const series of timeSeries) {
    if (!series.timeSeries?.datedValues) continue;

    for (const dv of series.timeSeries.datedValues) {
      const dateStr = `${dv.date.year}-${String(dv.date.month).padStart(2, '0')}-${String(dv.date.day).padStart(2, '0')}`;
      const value = parseInt(dv.value || '0', 10);

      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, {
          mapsDesktop: 0,
          mapsMobile: 0,
          searchDesktop: 0,
          searchMobile: 0,
          websiteClicks: 0,
          phoneCalls: 0,
          directionRequests: 0,
        });
      }

      const metrics = dateMap.get(dateStr)!;

      switch (series.dailyMetric) {
        case 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS':
          metrics.mapsDesktop = value;
          break;
        case 'BUSINESS_IMPRESSIONS_MOBILE_MAPS':
          metrics.mapsMobile = value;
          break;
        case 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH':
          metrics.searchDesktop = value;
          break;
        case 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH':
          metrics.searchMobile = value;
          break;
        case 'WEBSITE_CLICKS':
          metrics.websiteClicks = value;
          break;
        case 'CALL_CLICKS':
          metrics.phoneCalls = value;
          break;
        case 'BUSINESS_DIRECTION_REQUESTS':
          metrics.directionRequests = value;
          break;
      }
    }
  }

  // Convert to database records
  const fetchedAt = new Date().toISOString();
  return Array.from(dateMap.entries()).map(([date, metrics]) => ({
    location_id: locationId,
    date,
    views_maps: metrics.mapsDesktop + metrics.mapsMobile,
    views_search: metrics.searchDesktop + metrics.searchMobile,
    website_clicks: metrics.websiteClicks,
    phone_calls: metrics.phoneCalls,
    direction_requests: metrics.directionRequests,
    bookings: 0,
    fetched_at: fetchedAt,
  }));
}
