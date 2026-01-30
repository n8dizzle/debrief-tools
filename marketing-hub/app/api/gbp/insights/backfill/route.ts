import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getGoogleBusinessClient, DailyMetricTimeSeries } from '@/lib/google-business';
import { hasPermission, UserPermissions } from '@/lib/permissions';

/**
 * POST /api/gbp/insights/backfill
 * Backfill GBP performance data from Google API for a specific date range
 *
 * Auth: CRON_SECRET header OR session with can_sync_data permission
 *
 * Query params:
 * - start: Start date (YYYY-MM-DD) - required
 * - end: End date (YYYY-MM-DD) - required
 *
 * Note: Google API allows fetching up to 18 months of historical data
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

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'start and end query params are required (YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  // Validate date range (max 18 months)
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff > 550) {
    return NextResponse.json(
      { error: 'Date range cannot exceed 18 months (550 days)' },
      { status: 400 }
    );
  }

  if (daysDiff < 1) {
    return NextResponse.json(
      { error: 'End date must be after start date' },
      { status: 400 }
    );
  }

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
      console.error('[GBP Backfill] Failed to fetch locations:', locError);
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }

    if (!locations || locations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No locations configured',
        results: [],
      });
    }

    console.log(`[GBP Backfill] Backfilling ${locations.length} locations from ${startDate} to ${endDate} (${daysDiff} days)`);

    const results: Array<{
      location_id: string;
      location_name: string;
      rows_upserted: number;
      error?: string;
    }> = [];

    // Process each location
    for (const location of locations) {
      const result = {
        location_id: location.id,
        location_name: location.short_name || location.name,
        rows_upserted: 0,
        error: undefined as string | undefined,
      };

      try {
        console.log(`[GBP Backfill] Fetching ${location.short_name}...`);

        // Fetch insights from Google API
        const insights = await gbClient.getLocationInsights(
          location.google_location_id,
          startDate,
          endDate
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

        // Upsert to database in batches
        const BATCH_SIZE = 500;
        let totalUpserted = 0;

        for (let i = 0; i < dailyRecords.length; i += BATCH_SIZE) {
          const batch = dailyRecords.slice(i, i + BATCH_SIZE);
          const { error: upsertError } = await supabase
            .from('gbp_insights_cache')
            .upsert(batch, {
              onConflict: 'location_id,date',
              ignoreDuplicates: false,
            });

          if (upsertError) {
            console.error(`[GBP Backfill] Upsert error for ${location.short_name}:`, upsertError);
            result.error = upsertError.message;
            break;
          } else {
            totalUpserted += batch.length;
          }
        }

        result.rows_upserted = totalUpserted;
        console.log(`[GBP Backfill] ${location.short_name}: ${totalUpserted} rows`);
      } catch (err) {
        console.error(`[GBP Backfill] Error processing ${location.short_name}:`, err);
        result.error = err instanceof Error ? err.message : 'Unknown error';
      }

      results.push(result);

      // Small delay between locations to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const totalRows = results.reduce((sum, r) => sum + r.rows_upserted, 0);
    const errors = results.filter(r => r.error).length;

    console.log(`[GBP Backfill] Complete: ${totalRows} rows upserted, ${errors} errors`);

    return NextResponse.json({
      success: true,
      date_range: { start: startDate, end: endDate, days: daysDiff },
      locations_processed: locations.length,
      total_rows_upserted: totalRows,
      errors_count: errors,
      results,
    });
  } catch (error) {
    console.error('[GBP Backfill] Fatal error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Backfill failed' },
      { status: 500 }
    );
  }
}

/**
 * Build daily records from Google API time series data
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
