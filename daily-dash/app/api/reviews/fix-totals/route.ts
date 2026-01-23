import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

/**
 * POST /api/reviews/fix-totals
 * Fix the total_reviews counts in google_locations and add goals
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  // Get actual counts per location
  const { data: locations } = await supabase
    .from('google_locations')
    .select('id, short_name');

  if (!locations) {
    return NextResponse.json({ error: 'No locations found' }, { status: 404 });
  }

  const updates = [];

  for (const location of locations) {
    // Count actual reviews
    const { count } = await supabase
      .from('google_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', location.id);

    // Get average rating
    const { data: ratingData } = await supabase
      .from('google_reviews')
      .select('star_rating')
      .eq('location_id', location.id);

    const avgRating = ratingData && ratingData.length > 0
      ? ratingData.reduce((sum, r) => sum + r.star_rating, 0) / ratingData.length
      : 0;

    // Update location
    const { error } = await supabase
      .from('google_locations')
      .update({
        total_reviews: count || 0,
        average_rating: Math.round(avgRating * 100) / 100,
        updated_at: new Date().toISOString(),
      })
      .eq('id', location.id);

    updates.push({
      location: location.short_name,
      total_reviews: count,
      average_rating: Math.round(avgRating * 100) / 100,
      error: error?.message,
    });
  }

  // Add 2025 goal if it doesn't exist
  const { data: existingGoal } = await supabase
    .from('review_goals')
    .select('id')
    .eq('year', 2025)
    .eq('goal_type', 'total')
    .single();

  let goalResult = null;
  if (!existingGoal) {
    const { error: goalError } = await supabase
      .from('review_goals')
      .insert({ year: 2025, goal_type: 'total', target_count: 1000 });
    goalResult = goalError ? goalError.message : 'Added 2025 goal (1000)';
  } else {
    // Update existing goal
    const { error: goalError } = await supabase
      .from('review_goals')
      .update({ target_count: 1000 })
      .eq('year', 2025)
      .eq('goal_type', 'total');
    goalResult = goalError ? goalError.message : 'Updated 2025 goal to 1000';
  }

  // Get new totals
  const { data: newLocations } = await supabase
    .from('google_locations')
    .select('total_reviews');

  const newTotal = newLocations?.reduce((sum, loc) => sum + (loc.total_reviews || 0), 0) || 0;

  return NextResponse.json({
    success: true,
    updates,
    goalResult,
    newTotal,
  });
}
