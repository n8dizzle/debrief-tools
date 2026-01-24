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

interface MonthlyGoal {
  month: number;
  target_value: number;
  daily_target_value: number;
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
  period_goal: number | null; // null if no goal for that period's year
  monthly_goal: number | null; // Specific monthly target from spreadsheet
  daily_goal: number | null; // Specific daily target for current month
  year_progress_percent: number;
  expected_progress_percent: number;
  pacing_status: 'ahead' | 'on_track' | 'behind';
  pacing_difference_percent: number;
  locations: LocationStats[];
  rating_distribution: Record<number, number>;
  daily_counts: DailyCount[];
  period_start: string;
  period_end: string;
  period_year: number; // The year the period falls in
  monthly_goals: MonthlyGoal[]; // All monthly goals for the year
}

// 2026 Review targets from spreadsheet (can't store in dash_monthly_targets due to check constraint)
const REVIEW_TARGETS: Record<number, { monthly: number[]; daily: number[]; annual: number }> = {
  2026: {
    monthly: [68, 56, 76, 99, 137, 159, 159, 163, 96, 88, 75, 74], // Jan-Dec (sums to 1250)
    daily: [3, 3, 3, 4, 6, 7, 7, 7, 4, 4, 3, 4],
    annual: 1250,
  },
  2025: {
    monthly: [83, 83, 83, 83, 83, 83, 83, 83, 83, 83, 83, 87], // ~1000/year spread evenly
    daily: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
    annual: 1000,
  },
};

// Simple in-memory cache for stats
const statsCache = new Map<string, { data: ReviewStats; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute cache

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

  // Check cache
  const cacheKey = `${year}-${periodStart}-${periodEnd}`;
  const cached = statsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const supabase = getServerSupabase();

  // Date calculations
  const now = new Date();
  const startOfYear = new Date(year, 0, 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  let periodStartDate = periodStart ? new Date(periodStart) : startOfMonth;
  let periodEndDate = periodEnd ? new Date(periodEnd) : now;

  // Validate dates - fallback to defaults if invalid
  if (isNaN(periodStartDate.getTime())) {
    periodStartDate = startOfMonth;
  }
  if (isNaN(periodEndDate.getTime())) {
    periodEndDate = now;
  }

  // Calculate previous period for comparison
  const periodLength = periodEndDate.getTime() - periodStartDate.getTime();
  const previousPeriodStart = new Date(periodStartDate.getTime() - periodLength);
  const previousPeriodEnd = new Date(periodStartDate.getTime() - 1);

  // Get the year that the period falls in (for goal lookup)
  const periodYear = periodStartDate.getFullYear();

  // Run all queries in parallel for speed
  const [
    goalResult,
    periodGoalResult,
    locationsResult,
    totalReviewsCountResult,
    allRatingsResult,
    yearCountResult,
    monthCountResult,
    weekCountResult,
    todayCountResult,
    periodCountResult,
    previousPeriodCountResult,
    ratingDistBatch1,
    ratingDistBatch2,
    ratingDistBatch3,
    ratingDistBatch4,
    dailyCountsBatch1,
    dailyCountsBatch2,
    dailyCountsBatch3,
    dailyCountsBatch4,
    locationPeriodBatch1,
    locationPeriodBatch2,
    locationPeriodBatch3,
    locationPeriodBatch4,
    locationPrevPeriodResult,
    locationYearBatch1,
    locationYearBatch2,
    locationMonthResult,
    locationAllTimeBatch1,
    locationAllTimeBatch2,
    locationAllTimeBatch3,
    locationAllTimeBatch4,
  ] = await Promise.all([
    // Current year goal
    supabase
      .from('review_goals')
      .select('target_count')
      .eq('year', year)
      .eq('goal_type', 'total')
      .single(),

    // Period year goal (may be different from current year)
    supabase
      .from('review_goals')
      .select('target_count')
      .eq('year', periodYear)
      .eq('goal_type', 'total')
      .single(),

    // Locations
    supabase
      .from('google_locations')
      .select('id, name, short_name, total_reviews, average_rating, display_order')
      .eq('is_active', true)
      .order('display_order'),

    // Total reviews count (all time) - calculate from actual data
    supabase
      .from('google_reviews')
      .select('id', { count: 'exact', head: true }),

    // Period ratings for calculating average (matches selected period)
    supabase
      .from('google_reviews')
      .select('star_rating')
      .gte('create_time', periodStartDate.toISOString())
      .lte('create_time', periodEndDate.toISOString()),

    // Year count - use count instead of fetching all rows
    supabase
      .from('google_reviews')
      .select('id', { count: 'exact', head: true })
      .gte('create_time', startOfYear.toISOString())
      .lte('create_time', now.toISOString()),

    // Month count
    supabase
      .from('google_reviews')
      .select('id', { count: 'exact', head: true })
      .gte('create_time', startOfMonth.toISOString())
      .lte('create_time', now.toISOString()),

    // Week count
    supabase
      .from('google_reviews')
      .select('id', { count: 'exact', head: true })
      .gte('create_time', startOfWeek.toISOString())
      .lte('create_time', now.toISOString()),

    // Today count
    supabase
      .from('google_reviews')
      .select('id', { count: 'exact', head: true })
      .gte('create_time', startOfDay.toISOString())
      .lte('create_time', now.toISOString()),

    // Period count
    supabase
      .from('google_reviews')
      .select('id', { count: 'exact', head: true })
      .gte('create_time', periodStartDate.toISOString())
      .lte('create_time', periodEndDate.toISOString()),

    // Previous period count (for comparison)
    supabase
      .from('google_reviews')
      .select('id', { count: 'exact', head: true })
      .gte('create_time', previousPeriodStart.toISOString())
      .lte('create_time', previousPeriodEnd.toISOString()),

    // Rating distribution - 4 batches
    supabase.from('google_reviews').select('star_rating')
      .gte('create_time', periodStartDate.toISOString())
      .lte('create_time', periodEndDate.toISOString())
      .range(0, 999),
    supabase.from('google_reviews').select('star_rating')
      .gte('create_time', periodStartDate.toISOString())
      .lte('create_time', periodEndDate.toISOString())
      .range(1000, 1999),
    supabase.from('google_reviews').select('star_rating')
      .gte('create_time', periodStartDate.toISOString())
      .lte('create_time', periodEndDate.toISOString())
      .range(2000, 2999),
    supabase.from('google_reviews').select('star_rating')
      .gte('create_time', periodStartDate.toISOString())
      .lte('create_time', periodEndDate.toISOString())
      .range(3000, 3999),

    // Daily counts - 4 batches
    supabase.from('google_reviews').select('create_time')
      .gte('create_time', periodStartDate.toISOString())
      .lte('create_time', periodEndDate.toISOString())
      .order('create_time')
      .range(0, 999),
    supabase.from('google_reviews').select('create_time')
      .gte('create_time', periodStartDate.toISOString())
      .lte('create_time', periodEndDate.toISOString())
      .order('create_time')
      .range(1000, 1999),
    supabase.from('google_reviews').select('create_time')
      .gte('create_time', periodStartDate.toISOString())
      .lte('create_time', periodEndDate.toISOString())
      .order('create_time')
      .range(2000, 2999),
    supabase.from('google_reviews').select('create_time')
      .gte('create_time', periodStartDate.toISOString())
      .lte('create_time', periodEndDate.toISOString())
      .order('create_time')
      .range(3000, 3999),

    // Location period counts - 4 batches to bypass 1000 row limit
    supabase.from('google_reviews').select('location_id')
      .gte('create_time', periodStartDate.toISOString())
      .lte('create_time', periodEndDate.toISOString())
      .range(0, 999),
    supabase.from('google_reviews').select('location_id')
      .gte('create_time', periodStartDate.toISOString())
      .lte('create_time', periodEndDate.toISOString())
      .range(1000, 1999),
    supabase.from('google_reviews').select('location_id')
      .gte('create_time', periodStartDate.toISOString())
      .lte('create_time', periodEndDate.toISOString())
      .range(2000, 2999),
    supabase.from('google_reviews').select('location_id')
      .gte('create_time', periodStartDate.toISOString())
      .lte('create_time', periodEndDate.toISOString())
      .range(3000, 3999),

    // Location previous period counts (usually < 1000)
    supabase
      .from('google_reviews')
      .select('location_id')
      .gte('create_time', previousPeriodStart.toISOString())
      .lte('create_time', previousPeriodEnd.toISOString())
      .range(0, 999),

    // Location year counts - 4 batches
    supabase.from('google_reviews').select('location_id')
      .gte('create_time', startOfYear.toISOString())
      .lte('create_time', now.toISOString())
      .range(0, 999),
    supabase.from('google_reviews').select('location_id')
      .gte('create_time', startOfYear.toISOString())
      .lte('create_time', now.toISOString())
      .range(1000, 1999),

    // Location month counts (usually < 1000)
    supabase
      .from('google_reviews')
      .select('location_id')
      .gte('create_time', startOfMonth.toISOString())
      .lte('create_time', now.toISOString())
      .range(0, 999),

    // Location ALL TIME counts - first batch (0-999)
    supabase
      .from('google_reviews')
      .select('location_id')
      .range(0, 999),

    // Location ALL TIME counts - second batch (1000-1999)
    supabase
      .from('google_reviews')
      .select('location_id')
      .range(1000, 1999),

    // Location ALL TIME counts - third batch (2000-2999)
    supabase
      .from('google_reviews')
      .select('location_id')
      .range(2000, 2999),

    // Location ALL TIME counts - fourth batch (3000-3999)
    supabase
      .from('google_reviews')
      .select('location_id')
      .range(3000, 3999),
  ]);

  const yearGoal = goalResult.data?.target_count || 1250;
  const periodGoal = periodGoalResult.data?.target_count || null; // null if no goal exists for that year
  const locations = locationsResult.data || [];
  const totalReviewsActual = totalReviewsCountResult.count || 0;

  // Process monthly goals from hardcoded data (database has check constraint blocking 'reviews' type)
  const yearTargets = REVIEW_TARGETS[year] || REVIEW_TARGETS[2026];
  const monthlyGoals: MonthlyGoal[] = yearTargets.monthly.map((target, index) => ({
    month: index + 1,
    target_value: target,
    daily_target_value: yearTargets.daily[index],
  }));

  // Get current month's goal
  const currentMonth = now.getMonth() + 1; // 1-indexed
  const currentMonthGoal = monthlyGoals.find(g => g.month === currentMonth);
  const monthlyGoal = currentMonthGoal?.target_value || null;
  const dailyGoal = currentMonthGoal?.daily_target_value || null;

  if (locationsResult.error) {
    return NextResponse.json({ error: locationsResult.error.message }, { status: 500 });
  }

  // Calculate counts
  const reviewsThisYear = yearCountResult.count || 0;
  const reviewsThisMonth = monthCountResult.count || 0;
  const reviewsThisWeek = weekCountResult.count || 0;
  const reviewsToday = todayCountResult.count || 0;
  const reviewsThisPeriod = periodCountResult.count || 0;
  const reviewsPrevPeriod = previousPeriodCountResult.count || 0;

  // Calculate expected progress based on day of year
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const daysInYear = 365;
  const expectedProgressPercent = (dayOfYear / daysInYear) * 100;
  const yearProgressPercent = (reviewsThisYear / yearGoal) * 100;
  const pacingDifference = yearProgressPercent - expectedProgressPercent;

  let pacingStatus: 'ahead' | 'on_track' | 'behind' = 'on_track';
  if (pacingDifference > 5) pacingStatus = 'ahead';
  else if (pacingDifference < -5) pacingStatus = 'behind';

  // Rating distribution - combine batches
  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  [ratingDistBatch1, ratingDistBatch2, ratingDistBatch3, ratingDistBatch4].forEach(batch => {
    batch.data?.forEach(r => {
      ratingDistribution[r.star_rating] = (ratingDistribution[r.star_rating] || 0) + 1;
    });
  });

  // Build daily counts map
  const dailyCountsMap: Record<string, number> = {};

  // Initialize all days in period with 0
  const currentDate = new Date(periodStartDate);
  while (currentDate <= periodEndDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    dailyCountsMap[dateKey] = 0;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Count reviews per day - combine batches
  [dailyCountsBatch1, dailyCountsBatch2, dailyCountsBatch3, dailyCountsBatch4].forEach(batch => {
    batch.data?.forEach(r => {
      const dateKey = new Date(r.create_time).toISOString().split('T')[0];
      dailyCountsMap[dateKey] = (dailyCountsMap[dateKey] || 0) + 1;
    });
  });

  const dailyCounts: DailyCount[] = Object.entries(dailyCountsMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // Count reviews per location
  const locationPeriodCounts: Record<string, number> = {};
  const locationPrevPeriodCounts: Record<string, number> = {};
  const locationYearCounts: Record<string, number> = {};
  const locationMonthCounts: Record<string, number> = {};
  const locationAllTimeCounts: Record<string, number> = {};

  // Combine period batches
  [locationPeriodBatch1, locationPeriodBatch2, locationPeriodBatch3, locationPeriodBatch4].forEach(batch => {
    batch.data?.forEach(r => {
      locationPeriodCounts[r.location_id] = (locationPeriodCounts[r.location_id] || 0) + 1;
    });
  });

  locationPrevPeriodResult.data?.forEach(r => {
    locationPrevPeriodCounts[r.location_id] = (locationPrevPeriodCounts[r.location_id] || 0) + 1;
  });

  // Combine year batches
  [locationYearBatch1, locationYearBatch2].forEach(batch => {
    batch.data?.forEach(r => {
      locationYearCounts[r.location_id] = (locationYearCounts[r.location_id] || 0) + 1;
    });
  });

  locationMonthResult.data?.forEach(r => {
    locationMonthCounts[r.location_id] = (locationMonthCounts[r.location_id] || 0) + 1;
  });

  // Combine all 4 batches of all-time counts
  [locationAllTimeBatch1, locationAllTimeBatch2, locationAllTimeBatch3, locationAllTimeBatch4].forEach(batch => {
    batch.data?.forEach(r => {
      locationAllTimeCounts[r.location_id] = (locationAllTimeCounts[r.location_id] || 0) + 1;
    });
  });

  // Build location stats
  const locationStats: LocationStats[] = locations.map(location => {
    const periodReviews = locationPeriodCounts[location.id] || 0;
    const prevPeriodReviews = locationPrevPeriodCounts[location.id] || 0;

    let periodChangePercent: number | null = null;
    if (prevPeriodReviews > 0) {
      periodChangePercent = ((periodReviews - prevPeriodReviews) / prevPeriodReviews) * 100;
    } else if (periodReviews > 0) {
      periodChangePercent = 100;
    }

    return {
      id: location.id,
      name: location.name,
      short_name: location.short_name,
      total_reviews: locationAllTimeCounts[location.id] || 0,
      average_rating: location.average_rating || 0,
      reviews_this_year: locationYearCounts[location.id] || 0,
      reviews_this_month: locationMonthCounts[location.id] || 0,
      reviews_this_period: periodReviews,
      period_change_percent: periodChangePercent,
    };
  });

  // Calculate average rating from actual reviews
  const allRatings = allRatingsResult.data || [];
  const overallAvgRating = allRatings.length > 0
    ? allRatings.reduce((sum, r) => sum + r.star_rating, 0) / allRatings.length
    : 0;

  const stats: ReviewStats = {
    total_reviews: totalReviewsActual,
    average_rating: Math.round(overallAvgRating * 100) / 100,
    reviews_this_year: reviewsThisYear,
    reviews_this_month: reviewsThisMonth,
    reviews_today: reviewsToday,
    reviews_this_week: reviewsThisWeek,
    reviews_this_period: reviewsThisPeriod,
    year_goal: yearGoal,
    period_goal: periodGoal,
    monthly_goal: monthlyGoal,
    daily_goal: dailyGoal,
    year_progress_percent: Math.round(yearProgressPercent * 10) / 10,
    expected_progress_percent: Math.round(expectedProgressPercent * 10) / 10,
    pacing_status: pacingStatus,
    pacing_difference_percent: Math.round(pacingDifference * 10) / 10,
    locations: locationStats,
    rating_distribution: ratingDistribution,
    daily_counts: dailyCounts,
    period_start: periodStartDate.toISOString(),
    period_end: periodEndDate.toISOString(),
    period_year: periodYear,
    monthly_goals: monthlyGoals,
  };

  // Cache the result
  statsCache.set(cacheKey, { data: stats, timestamp: Date.now() });

  return NextResponse.json(stats);
}
