import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

interface LeaderboardEntry {
  name: string;
  wtd: number;
  mtd: number;
  ytd: number;
  five_star_wtd: number;
  five_star_mtd: number;
  five_star_ytd: number;
}

/**
 * GET /api/reviews/leaderboard
 * Get team member leaderboard with WTD, MTD, YTD counts
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const now = new Date();
  const year = now.getFullYear();

  // Calculate date ranges
  // WTD: Monday of current week through today
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 6 days back, else dayOfWeek - 1
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  monday.setHours(0, 0, 0, 0);

  // MTD: First of current month through today
  const firstOfMonth = new Date(year, now.getMonth(), 1);

  // YTD: First of year through today
  const firstOfYear = new Date(year, 0, 1);

  // End of today
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const wtdStart = monday.toISOString();
  const mtdStart = firstOfMonth.toISOString();
  const ytdStart = firstOfYear.toISOString();
  const periodEnd = endOfToday.toISOString();

  // Fetch all reviews with mentions for the year
  const { data: reviews, error } = await supabase
    .from('google_reviews')
    .select('team_members_mentioned, star_rating, create_time')
    .not('team_members_mentioned', 'is', null)
    .gte('create_time', ytdStart)
    .lte('create_time', periodEnd);

  if (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }

  if (!reviews || reviews.length === 0) {
    return NextResponse.json({ leaderboard: [] });
  }

  // Aggregate by team member with period breakdown
  const leaderboard: Record<string, LeaderboardEntry> = {};

  reviews.forEach((review) => {
    const mentions = review.team_members_mentioned as string[];
    if (!mentions || mentions.length === 0) return;

    const reviewDate = new Date(review.create_time);
    const isFiveStar = review.star_rating === 5;

    // Determine which periods this review falls into
    const isWtd = reviewDate >= monday;
    const isMtd = reviewDate >= firstOfMonth;
    // YTD is always true since we filtered by ytdStart

    mentions.forEach((name) => {
      if (!leaderboard[name]) {
        leaderboard[name] = {
          name,
          wtd: 0,
          mtd: 0,
          ytd: 0,
          five_star_wtd: 0,
          five_star_mtd: 0,
          five_star_ytd: 0,
        };
      }

      // Always count for YTD
      leaderboard[name].ytd++;
      if (isFiveStar) leaderboard[name].five_star_ytd++;

      // Count for MTD if in current month
      if (isMtd) {
        leaderboard[name].mtd++;
        if (isFiveStar) leaderboard[name].five_star_mtd++;
      }

      // Count for WTD if in current week
      if (isWtd) {
        leaderboard[name].wtd++;
        if (isFiveStar) leaderboard[name].five_star_wtd++;
      }
    });
  });

  // Sort by YTD by default (frontend can re-sort)
  const sorted = Object.values(leaderboard).sort((a, b) => b.ytd - a.ytd);

  return NextResponse.json({
    leaderboard: sorted,
    periods: {
      wtd: { start: wtdStart, end: periodEnd, label: 'Week to Date' },
      mtd: { start: mtdStart, end: periodEnd, label: 'Month to Date' },
      ytd: { start: ytdStart, end: periodEnd, label: 'Year to Date' },
    },
  });
}
