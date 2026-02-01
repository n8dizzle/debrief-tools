import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { getGoogleAnalyticsClient } from '@/lib/google-analytics';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const maxDuration = 120; // 2 minute timeout for backfill

export async function POST(request: Request) {
  try {
    // Check for CRON_SECRET or authenticated user with sync permission
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    let isAuthorized = false;

    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true;
    } else {
      const session = await getServerSession(authOptions);
      if (session?.user?.email) {
        const { role, permissions } = session.user as {
          role: 'employee' | 'manager' | 'owner';
          permissions: Record<string, unknown> | null;
        };
        if (hasPermission(role, permissions, 'marketing_hub', 'can_sync_data')) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const days = body.days || 90; // Default to 90 days backfill

    const client = getGoogleAnalyticsClient();

    if (!client.isConfigured()) {
      return NextResponse.json(
        { error: 'Google Analytics not configured' },
        { status: 500 }
      );
    }

    console.log(`[GA4 Backfill] Starting backfill for ${days} days...`);

    const results = {
      days,
      daily: { processed: 0, errors: 0 },
      sources: { processed: 0, errors: 0 },
      pages: { processed: 0, errors: 0 },
      conversions: { processed: 0, errors: 0 },
    };

    // Get daily traffic for the full period
    const dailyTraffic = await client.getDailyTraffic(days);

    for (const day of dailyTraffic) {
      // GA4 returns date as YYYYMMDD, convert to YYYY-MM-DD
      const formattedDate = day.date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');

      const { error } = await supabase
        .from('ga4_daily_cache')
        .upsert(
          {
            date: formattedDate,
            sessions: day.sessions,
            users: day.users,
            pageviews: day.pageviews,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: 'date' }
        );

      if (error) {
        console.error(`[GA4 Backfill] Error for date ${formattedDate}:`, error);
        results.daily.errors++;
      } else {
        results.daily.processed++;
      }
    }

    // Get sources for the full period
    const sources = await client.getTrafficSources(days, 50);
    const today = new Date().toISOString().split('T')[0];

    for (const source of sources) {
      const { error } = await supabase
        .from('ga4_sources_cache')
        .upsert(
          {
            date: today, // Aggregate for full period
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

      if (error) {
        results.sources.errors++;
      } else {
        results.sources.processed++;
      }
    }

    // Get top pages for the full period
    const pages = await client.getTopPages(days, 50);

    for (const page of pages) {
      const { error } = await supabase
        .from('ga4_pages_cache')
        .upsert(
          {
            date: today,
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

      if (error) {
        results.pages.errors++;
      } else {
        results.pages.processed++;
      }
    }

    // Get conversions for the full period
    const conversions = await client.getConversions(days);

    for (const conv of conversions) {
      const { error } = await supabase
        .from('ga4_conversions_cache')
        .upsert(
          {
            date: today,
            event_name: conv.eventName,
            event_count: conv.eventCount,
            total_users: conv.totalUsers,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: 'date,event_name' }
        );

      if (error) {
        results.conversions.errors++;
      } else {
        results.conversions.processed++;
      }
    }

    console.log('[GA4 Backfill] Complete:', results);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('[GA4 Backfill] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Backfill failed' },
      { status: 500 }
    );
  }
}
