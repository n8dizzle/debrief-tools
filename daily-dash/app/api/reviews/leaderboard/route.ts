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
 * Get a date string (YYYY-MM-DD) in Central Time from a Date or ISO string
 */
function toCentralDateString(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }); // en-CA gives YYYY-MM-DD format
}

/**
 * Get today's date string in Central Time
 */
function getTodayCentral(): string {
  return toCentralDateString(new Date());
}

/**
 * GET /api/reviews/leaderboard
 * Get team member leaderboard with WTD, MTD, YTD counts
 * Query params: period (preset name), startDate, endDate (ISO strings)
 *
 * All date comparisons use Central Time (Texas timezone)
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

  // Get reference date in Central Time (YYYY-MM-DD)
  const todayCentral = getTodayCentral();
  const refDateStr = endDateParam ? toCentralDateString(endDateParam) : todayCentral;

  // Parse reference date components
  const [refYear, refMonth, refDay] = refDateStr.split('-').map(Number);

  // Calculate period boundary date strings (YYYY-MM-DD)
  // WTD: Monday of the week containing refDate
  const refDate = new Date(refYear, refMonth - 1, refDay);
  const dayOfWeek = refDate.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const mondayDate = new Date(refYear, refMonth - 1, refDay - mondayOffset);
  const wtdStartStr = `${mondayDate.getFullYear()}-${String(mondayDate.getMonth() + 1).padStart(2, '0')}-${String(mondayDate.getDate()).padStart(2, '0')}`;

  // MTD: First of the month containing refDate
  const mtdStartStr = `${refYear}-${String(refMonth).padStart(2, '0')}-01`;

  // YTD: First of the year containing refDate
  const ytdStartStr = `${refYear}-01-01`;

  // Determine which columns are active based on period
  let showWtd = true;
  let showMtd = true;

  switch (period) {
    case 'last_year':
      showWtd = false;
      showMtd = false;
      break;
    case 'last_month':
    case 'last_quarter':
    case 'this_quarter':
      showWtd = false;
      break;
  }

  // Query start date (earliest boundary we need)
  const queryStartStr = ytdStartStr;

  // Fetch all reviews with mentions from YTD start
  // Fetch both confirmed_mentions and team_members_mentioned; prefer confirmed when available
  const { data: reviews, error } = await supabase
    .from('google_reviews')
    .select('team_members_mentioned, confirmed_mentions, star_rating, create_time')
    .or('team_members_mentioned.not.is.null,confirmed_mentions.not.is.null')
    .gte('create_time', `${queryStartStr}T00:00:00`)
    .lte('create_time', `${refDateStr}T23:59:59`)
    .limit(10000);

  if (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }

  if (!reviews || reviews.length === 0) {
    return NextResponse.json({ leaderboard: [], showWtd, showMtd });
  }

  // Aggregate by team member with period breakdown
  const leaderboard: Record<string, LeaderboardEntry> = {};

  reviews.forEach((review) => {
    // Prefer confirmed_mentions (human-verified) over team_members_mentioned (AI-detected)
    const confirmed = review.confirmed_mentions as string[] | null;
    const aiDetected = review.team_members_mentioned as string[] | null;
    const mentions = confirmed ?? aiDetected;
    if (!mentions || mentions.length === 0) return;

    // Get review date in Central Time as YYYY-MM-DD string
    const reviewDateStr = toCentralDateString(review.create_time);
    const isFiveStar = review.star_rating === 5;

    // Compare date strings (lexicographic comparison works for YYYY-MM-DD)
    const isWtd = showWtd && reviewDateStr >= wtdStartStr && reviewDateStr <= refDateStr;
    const isMtd = showMtd && reviewDateStr >= mtdStartStr && reviewDateStr <= refDateStr;
    const isYtd = reviewDateStr >= ytdStartStr && reviewDateStr <= refDateStr;

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
    showWtd,
    showMtd,
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    }
  });
}
