import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

interface LeaderboardEntry {
  name: string;
  count: number;
  five_star_count: number;
}

/**
 * GET /api/reviews/leaderboard
 * Get team member leaderboard for a given date range
 * Query params: startDate, endDate (ISO strings)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Fetch reviews with mentions for the given period
  const { data: reviews, error } = await supabase
    .from('google_reviews')
    .select('team_members_mentioned, star_rating, create_time')
    .not('team_members_mentioned', 'is', null)
    .gte('create_time', startDate)
    .lte('create_time', endDate);

  if (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }

  if (!reviews || reviews.length === 0) {
    return NextResponse.json({ leaderboard: [] });
  }

  // Aggregate by team member
  const leaderboard: Record<string, LeaderboardEntry> = {};

  reviews.forEach((review) => {
    const mentions = review.team_members_mentioned as string[];
    if (!mentions || mentions.length === 0) return;

    const isFiveStar = review.star_rating === 5;

    mentions.forEach((name) => {
      if (!leaderboard[name]) {
        leaderboard[name] = {
          name,
          count: 0,
          five_star_count: 0,
        };
      }

      leaderboard[name].count++;
      if (isFiveStar) leaderboard[name].five_star_count++;
    });
  });

  // Sort by count descending
  const sorted = Object.values(leaderboard).sort((a, b) => b.count - a.count);

  return NextResponse.json({
    leaderboard: sorted,
  });
}
