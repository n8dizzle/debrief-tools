import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

interface LocationStats {
  id: string;
  name: string;
  short_name: string;
  total_reviews: number;
  average_rating: number;
  reviews_this_year: number;
  reviews_this_month: number;
  reviews_this_period: number;
  period_change_percent: number | null;
}

interface DailyCount {
  date: string;
  count: number;
}

interface ReviewStats {
  total_reviews: number;
  average_rating: number;
  reviews_this_year: number;
  reviews_this_month: number;
  reviews_today: number;
  reviews_this_week: number;
  reviews_this_period: number;
  year_goal: number;
  year_progress_percent: number;
  expected_progress_percent: number;
  pacing_status: 'ahead' | 'on_track' | 'behind';
  pacing_difference_percent: number;
  locations: LocationStats[];
  rating_distribution: Record<number, number>;
  daily_counts: DailyCount[];
  period_start: string;
  period_end: string;
}

/**
 * GET /api/reviews/stats
 * Get aggregated review statistics for dashboard
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
  const periodStart = searchParams.get('periodStart');
  const periodEnd = searchParams.get('periodEnd');

  const supabase = getServerSupabase();

  // Get year goal
  const { data: goalData } = await supabase
    .from('review_goals')
    .select('target_count')
    .eq('year', year)
    .eq('goal_type', 'total')
    .single();

  const yearGoal = goalData?.target_count || 1250;

  // Get all locations
  const { data: locations, error: locationsError } = await supabase
    .from('google_locations')
    .select('id, name, short_name, total_reviews, average_rating, display_order')
    .eq('is_active', true)
    .order('display_order');

  if (locationsError) {
    return NextResponse.json({ error: locationsError.message }, { status: 500 });
  }

  // Date calculations
  const now = new Date();
  const startOfYear = new Date(year, 0, 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  // Calculate expected progress based on day of year
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const daysInYear = 365;
  const expectedProgressPercent = (dayOfYear / daysInYear) * 100;

  // Get all reviews for this year for aggregation
  const { data: yearReviews, error: reviewsError } = await supabase
    .from('google_reviews')
    .select('id, location_id, star_rating, create_time')
    .gte('create_time', startOfYear.toISOString())
    .lte('create_time', now.toISOString());

  if (reviewsError) {
    return NextResponse.json({ error: reviewsError.message }, { status: 500 });
  }

  // Calculate aggregated stats
  const reviewsThisYear = yearReviews?.length || 0;
  const yearProgressPercent = (reviewsThisYear / yearGoal) * 100;
  const pacingDifference = yearProgressPercent - expectedProgressPercent;

  let pacingStatus: 'ahead' | 'on_track' | 'behind' = 'on_track';
  if (pacingDifference > 5) pacingStatus = 'ahead';
  else if (pacingDifference < -5) pacingStatus = 'behind';

  // Count reviews by time period
  const reviewsThisMonth = yearReviews?.filter(r =>
    new Date(r.create_time) >= startOfMonth
  ).length || 0;

  const reviewsThisWeek = yearReviews?.filter(r =>
    new Date(r.create_time) >= startOfWeek
  ).length || 0;

  const reviewsToday = yearReviews?.filter(r =>
    new Date(r.create_time) >= startOfDay
  ).length || 0;

  // Rating distribution
  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  yearReviews?.forEach(r => {
    ratingDistribution[r.star_rating] = (ratingDistribution[r.star_rating] || 0) + 1;
  });

  // Calculate daily counts for the selected period
  const periodStartDate = periodStart ? new Date(periodStart) : startOfMonth;
  const periodEndDate = periodEnd ? new Date(periodEnd) : now;

  // Build daily counts map
  const dailyCountsMap: Record<string, number> = {};

  // Initialize all days in period with 0
  const currentDate = new Date(periodStartDate);
  while (currentDate <= periodEndDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    dailyCountsMap[dateKey] = 0;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Count reviews per day within the period
  yearReviews?.forEach(r => {
    const reviewDate = new Date(r.create_time);
    if (reviewDate >= periodStartDate && reviewDate <= periodEndDate) {
      const dateKey = reviewDate.toISOString().split('T')[0];
      dailyCountsMap[dateKey] = (dailyCountsMap[dateKey] || 0) + 1;
    }
  });

  // Convert to sorted array
  const dailyCounts: DailyCount[] = Object.entries(dailyCountsMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // Count total reviews in period
  const reviewsThisPeriod = yearReviews?.filter(r => {
    const reviewDate = new Date(r.create_time);
    return reviewDate >= periodStartDate && reviewDate <= periodEndDate;
  }).length || 0;

  // Calculate average rating for the year
  const avgRating = yearReviews && yearReviews.length > 0
    ? yearReviews.reduce((sum, r) => sum + r.star_rating, 0) / yearReviews.length
    : 0;

  // Get total reviews across all locations
  const totalReviews = locations?.reduce((sum, loc) => sum + (loc.total_reviews || 0), 0) || 0;
  const overallAvgRating = locations && locations.length > 0
    ? locations.reduce((sum, loc) => sum + (loc.average_rating || 0) * (loc.total_reviews || 0), 0) /
      Math.max(totalReviews, 1)
    : 0;

  // Calculate per-location stats
  const locationStats: LocationStats[] = [];

  for (const location of locations || []) {
    const locationYearReviews = yearReviews?.filter(r => r.location_id === location.id) || [];
    const locationMonthReviews = locationYearReviews.filter(r =>
      new Date(r.create_time) >= startOfMonth
    );

    // Period reviews (if period specified)
    let periodReviews = 0;
    let periodChangePercent: number | null = null;

    if (periodStart && periodEnd) {
      const periodStartDate = new Date(periodStart);
      const periodEndDate = new Date(periodEnd);
      const periodLength = periodEndDate.getTime() - periodStartDate.getTime();
      const previousPeriodStart = new Date(periodStartDate.getTime() - periodLength);

      periodReviews = locationYearReviews.filter(r => {
        const reviewDate = new Date(r.create_time);
        return reviewDate >= periodStartDate && reviewDate <= periodEndDate;
      }).length;

      const previousPeriodReviews = locationYearReviews.filter(r => {
        const reviewDate = new Date(r.create_time);
        return reviewDate >= previousPeriodStart && reviewDate < periodStartDate;
      }).length;

      if (previousPeriodReviews > 0) {
        periodChangePercent = ((periodReviews - previousPeriodReviews) / previousPeriodReviews) * 100;
      } else if (periodReviews > 0) {
        periodChangePercent = 100;
      }
    }

    locationStats.push({
      id: location.id,
      name: location.name,
      short_name: location.short_name,
      total_reviews: location.total_reviews || 0,
      average_rating: location.average_rating || 0,
      reviews_this_year: locationYearReviews.length,
      reviews_this_month: locationMonthReviews.length,
      reviews_this_period: periodReviews,
      period_change_percent: periodChangePercent,
    });
  }

  const stats: ReviewStats = {
    total_reviews: totalReviews,
    average_rating: Math.round(overallAvgRating * 100) / 100,
    reviews_this_year: reviewsThisYear,
    reviews_this_month: reviewsThisMonth,
    reviews_today: reviewsToday,
    reviews_this_week: reviewsThisWeek,
    reviews_this_period: reviewsThisPeriod,
    year_goal: yearGoal,
    year_progress_percent: Math.round(yearProgressPercent * 10) / 10,
    expected_progress_percent: Math.round(expectedProgressPercent * 10) / 10,
    pacing_status: pacingStatus,
    pacing_difference_percent: Math.round(pacingDifference * 10) / 10,
    locations: locationStats,
    rating_distribution: ratingDistribution,
    daily_counts: dailyCounts,
    period_start: periodStartDate.toISOString(),
    period_end: periodEndDate.toISOString(),
  };

  return NextResponse.json(stats);
}
