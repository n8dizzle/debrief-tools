import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

const APP_LABELS: Record<string, string> = {
  daily_dash: 'Daily Dash',
  marketing_hub: 'Marketing Hub',
  ar_collections: 'AR Collections',
  job_tracker: 'Job Tracker',
  ap_payments: 'AP Payments',
  membership_manager: 'Membership Manager',
  doc_dispatch: 'Doc Dispatch',
  celebrations: 'Celebrations',
  internal_portal: 'Internal Portal',
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { role } = session.user as any;
    if (role === 'employee') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServerSupabase();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

    // Total page views in period
    const { count: totalViews } = await supabase
      .from('analytics_page_views')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since);

    // Unique users in period
    const { data: uniqueUsersData } = await supabase
      .from('analytics_page_views')
      .select('user_email')
      .gte('created_at', since);

    const uniqueEmails = new Set(uniqueUsersData?.map((r: any) => r.user_email) || []);

    // Views per app
    const { data: allViews } = await supabase
      .from('analytics_page_views')
      .select('app, user_email, path, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    // Aggregate views per app
    const appCounts: Record<string, { views: number; users: Set<string> }> = {};
    allViews?.forEach((row: any) => {
      if (!appCounts[row.app]) {
        appCounts[row.app] = { views: 0, users: new Set() };
      }
      appCounts[row.app].views++;
      appCounts[row.app].users.add(row.user_email);
    });

    const appStats = Object.entries(appCounts)
      .map(([app, data]) => ({
        app,
        label: APP_LABELS[app] || app,
        views: data.views,
        uniqueUsers: data.users.size,
      }))
      .sort((a, b) => b.views - a.views);

    // Views per user
    const userCounts: Record<string, { views: number; apps: Set<string> }> = {};
    allViews?.forEach((row: any) => {
      if (!userCounts[row.user_email]) {
        userCounts[row.user_email] = { views: 0, apps: new Set() };
      }
      userCounts[row.user_email].views++;
      userCounts[row.user_email].apps.add(row.app);
    });

    const userStats = Object.entries(userCounts)
      .map(([email, data]) => ({
        email,
        name: email.split('@')[0].replace('.', ' ').replace(/\b\w/g, c => c.toUpperCase()),
        views: data.views,
        appsUsed: data.apps.size,
        apps: Array.from(data.apps).map(a => APP_LABELS[a] || a),
      }))
      .sort((a, b) => b.views - a.views);

    // Top pages per app
    const pageCounts: Record<string, Record<string, number>> = {};
    allViews?.forEach((row: any) => {
      if (!pageCounts[row.app]) pageCounts[row.app] = {};
      pageCounts[row.app][row.path] = (pageCounts[row.app][row.path] || 0) + 1;
    });

    const topPages = Object.entries(pageCounts).map(([app, paths]) => ({
      app,
      label: APP_LABELS[app] || app,
      pages: Object.entries(paths)
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    }));

    // Daily trend (last N days)
    const dailyCounts: Record<string, Record<string, number>> = {};
    allViews?.forEach((row: any) => {
      const date = row.created_at.split('T')[0];
      if (!dailyCounts[date]) dailyCounts[date] = {};
      dailyCounts[date][row.app] = (dailyCounts[date][row.app] || 0) + 1;
    });

    // Build sorted daily array
    const dailyTrend = Object.entries(dailyCounts)
      .map(([date, apps]) => ({ date, ...apps, total: Object.values(apps).reduce((s, c) => s + c, 0) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      period: { days, since },
      summary: {
        totalViews: totalViews || 0,
        uniqueUsers: uniqueEmails.size,
        totalApps: appStats.length,
      },
      appStats,
      userStats,
      topPages,
      dailyTrend,
      appLabels: APP_LABELS,
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
