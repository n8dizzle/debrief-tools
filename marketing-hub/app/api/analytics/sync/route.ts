import { NextResponse } from 'next/server';
import { getGoogleAnalyticsClient } from '@/lib/google-analytics';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client with service role for cron operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const maxDuration = 60; // 60 second timeout for cron

export async function GET(request: Request) {
  // Verify cron secret for automated syncs
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const client = getGoogleAnalyticsClient();

    if (!client.isConfigured()) {
      return NextResponse.json(
        { error: 'Google Analytics not configured', configured: false },
        { status: 200 } // Return 200 to not break cron
      );
    }

    console.log('[GA4 Sync] Starting daily sync...');

    // Fetch yesterday's data (today's data is incomplete)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    console.log(`[GA4 Sync] Fetching data for ${dateStr}`);

    // Fetch all data types
    const [dailyTraffic, sources, pages, conversions] = await Promise.all([
      client.getDailyTraffic(1), // Just yesterday
      client.getTrafficSources(1, 20),
      client.getTopPages(1, 30),
      client.getConversions(1),
    ]);

    const results = {
      date: dateStr,
      daily: { inserted: 0, updated: 0 },
      sources: { inserted: 0, updated: 0 },
      pages: { inserted: 0, updated: 0 },
      conversions: { inserted: 0, updated: 0 },
    };

    // Upsert daily traffic
    if (dailyTraffic.length > 0) {
      const day = dailyTraffic[0];
      // GA4 returns date as YYYYMMDD, convert to YYYY-MM-DD
      const formattedDate = day.date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');

      const { error } = await supabase
        .from('ga4_daily_cache')
        .upsert(
          {
            date: formattedDate,
            sessions: day.sessions,
            users: day.users,
            new_users: 0, // Not in daily response, would need separate query
            pageviews: day.pageviews,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: 'date' }
        );

      if (error) {
        console.error('[GA4 Sync] Daily upsert error:', error);
      } else {
        results.daily.inserted = 1;
      }
    }

    // Upsert sources
    for (const source of sources) {
      const { error } = await supabase
        .from('ga4_sources_cache')
        .upsert(
          {
            date: dateStr,
            source: source.source,
            medium: source.medium,
            sessions: source.sessions,
            users: source.users,
            new_users: source.newUsers,
            bounce_rate: source.bounceRate,
            engagement_rate: source.engagementRate,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: 'date,source,medium' }
        );

      if (!error) {
        results.sources.inserted++;
      }
    }

    // Upsert pages
    for (const page of pages) {
      const { error } = await supabase
        .from('ga4_pages_cache')
        .upsert(
          {
            date: dateStr,
            page_path: page.pagePath,
            page_title: page.pageTitle,
            pageviews: page.pageviews,
            unique_pageviews: page.uniquePageviews,
            avg_time_on_page: page.avgTimeOnPage,
            bounce_rate: page.bounceRate,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: 'date,page_path' }
        );

      if (!error) {
        results.pages.inserted++;
      }
    }

    // Upsert conversions
    for (const conv of conversions) {
      const { error } = await supabase
        .from('ga4_conversions_cache')
        .upsert(
          {
            date: dateStr,
            event_name: conv.eventName,
            event_count: conv.eventCount,
            total_users: conv.totalUsers,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: 'date,event_name' }
        );

      if (!error) {
        results.conversions.inserted++;
      }
    }

    console.log('[GA4 Sync] Sync complete:', results);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('[GA4 Sync] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
