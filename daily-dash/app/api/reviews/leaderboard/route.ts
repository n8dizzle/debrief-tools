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
 * Query params: period (preset name), startDate, endDate (ISO strings)
 *
 * Period context determines which columns are relevant:
 * - this_month, this_week, last_30, last_90: WTD, MTD, YTD all active
 * - last_month: MTD (for that month), YTD active; WTD = 0
 * - this_quarter, last_quarter: MTD, YTD active; WTD = 0
 * - this_year: WTD, MTD, YTD all active
 * - last_year: YTD only (for that year); WTD, MTD = 0
 * - all_time: current WTD, MTD, YTD
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'this_month';
  const startDateParam = searchParams.get('startDate');
  const endDateParam = searchParams.get('endDate');

  const supabase = getServerSupabase();
  const now = new Date();
  const endDate = endDateParam ? new Date(endDateParam) : now;

  // Calculate period boundaries based on context
  let wtdStart: Date | null = null;
  let mtdStart: Date | null = null;
  let ytdStart: Date | null = null;

  // Determine the reference date for calculations (end of selected period)
  const refDate = new Date(endDate);

  // Calculate WTD start (Monday of the week containing refDate)
  const dayOfWeek = refDate.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() - mondayOffset);
  monday.setHours(0, 0, 0, 0);

  // Calculate MTD start (first of the month containing refDate)
  const firstOfMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 1);

  // Calculate YTD start (first of the year containing refDate)
  const firstOfYear = new Date(refDate.getFullYear(), 0, 1);

  // Determine which columns are active based on period
  switch (period) {
    case 'last_year':
      // Only YTD for that year, no WTD/MTD
      ytdStart = firstOfYear;
      break;
    case 'last_month':
    case 'last_quarter':
    case 'this_quarter':
      // MTD and YTD, no WTD
      mtdStart = firstOfMonth;
      ytdStart = firstOfYear;
      break;
    case 'this_month':
    case 'this_week':
    case 'this_year':
    case 'last_30':
    case 'last_90':
    case 'all_time':
    case 'custom':
    default:
      // All columns active
      wtdStart = monday;
      mtdStart = firstOfMonth;
      ytdStart = firstOfYear;
      break;
  }

  // Use startDate param if provided and it's earlier than our calculated start
  const queryStart = startDateParam
    ? new Date(Math.min(new Date(startDateParam).getTime(), (ytdStart || firstOfYear).getTime()))
    : (ytdStart || firstOfYear);

  // Fetch all reviews with mentions from the earliest relevant date
  const { data: reviews, error } = await supabase
    .from('google_reviews')
    .select('team_members_mentioned, star_rating, create_time')
    .not('team_members_mentioned', 'is', null)
    .gte('create_time', queryStart.toISOString())
    .lte('create_time', endDate.toISOString());

  if (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }

  if (!reviews || reviews.length === 0) {
    return NextResponse.json({ leaderboard: [], showWtd: !!wtdStart, showMtd: !!mtdStart });
  }

  // Aggregate by team member with period breakdown
  const leaderboard: Record<string, LeaderboardEntry> = {};

  reviews.forEach((review) => {
    const mentions = review.team_members_mentioned as string[];
    if (!mentions || mentions.length === 0) return;

    const reviewDate = new Date(review.create_time);
    const isFiveStar = review.star_rating === 5;

    // Determine which periods this review falls into
    const isWtd = wtdStart && reviewDate >= wtdStart;
    const isMtd = mtdStart && reviewDate >= mtdStart;
    const isYtd = ytdStart && reviewDate >= ytdStart;

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

      if (isYtd) {
        leaderboard[name].ytd++;
        if (isFiveStar) leaderboard[name].five_star_ytd++;
      }

      if (isMtd) {
        leaderboard[name].mtd++;
        if (isFiveStar) leaderboard[name].five_star_mtd++;
      }

      if (isWtd) {
        leaderboard[name].wtd++;
        if (isFiveStar) leaderboard[name].five_star_wtd++;
      }
    });
  });

  // Sort by YTD by default
  const sorted = Object.values(leaderboard).sort((a, b) => b.ytd - a.ytd);

  return NextResponse.json({
    leaderboard: sorted,
    showWtd: !!wtdStart,
    showMtd: !!mtdStart,
  });
}
