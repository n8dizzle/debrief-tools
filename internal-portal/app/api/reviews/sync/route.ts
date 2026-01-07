import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import {
  getGoogleBusinessClient,
  starRatingToNumber,
  findTeamMemberMentions,
  GoogleReview,
} from '@/lib/google-business';

/**
 * POST /api/reviews/sync
 * Sync reviews from Google Business Profile API
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user has owner/manager role
  const { role } = session.user as { role?: string };
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const supabase = getServerSupabase();
  const googleClient = getGoogleBusinessClient();

  if (!googleClient.isConfigured()) {
    return NextResponse.json(
      { error: 'Google Business Profile API not configured' },
      { status: 500 }
    );
  }

  try {
    // Get all active locations with Google credentials
    const { data: locations, error: locationsError } = await supabase
      .from('google_locations')
      .select('*')
      .eq('is_active', true)
      .not('google_account_id', 'is', null)
      .not('google_location_id', 'is', null);

    if (locationsError) {
      throw new Error(`Failed to fetch locations: ${locationsError.message}`);
    }

    if (!locations || locations.length === 0) {
      return NextResponse.json({
        message: 'No locations configured with Google credentials',
        synced: 0,
      });
    }

    // Get team members for mention detection
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('name, aliases')
      .eq('is_active', true);

    let totalSynced = 0;
    const errors: string[] = [];

    // Sync reviews for each location
    for (const location of locations) {
      try {
        const reviews = await googleClient.getAllReviews(
          location.google_account_id,
          location.google_location_id
        );

        // Process and upsert reviews
        for (const review of reviews) {
          const teamMentions = teamMembers
            ? findTeamMemberMentions(review.comment || '', teamMembers)
            : [];

          const reviewData = {
            location_id: location.id,
            google_review_id: review.reviewId,
            reviewer_name: review.reviewer?.displayName || 'Anonymous',
            reviewer_photo_url: review.reviewer?.profilePhotoUrl,
            star_rating: starRatingToNumber(review.starRating),
            comment: review.comment,
            review_reply: review.reviewReply?.comment,
            reply_time: review.reviewReply?.updateTime,
            create_time: review.createTime,
            update_time: review.updateTime,
            team_members_mentioned: teamMentions.length > 0 ? teamMentions : null,
            is_processed: true,
            updated_at: new Date().toISOString(),
          };

          const { error: upsertError } = await supabase
            .from('google_reviews')
            .upsert(reviewData, {
              onConflict: 'google_review_id',
              ignoreDuplicates: false,
            });

          if (upsertError) {
            console.error(`Failed to upsert review ${review.reviewId}:`, upsertError);
          } else {
            totalSynced++;
          }
        }

        // Update location stats
        const { data: reviewStats } = await supabase
          .from('google_reviews')
          .select('star_rating')
          .eq('location_id', location.id);

        if (reviewStats && reviewStats.length > 0) {
          const totalReviews = reviewStats.length;
          const avgRating = reviewStats.reduce((sum, r) => sum + r.star_rating, 0) / totalReviews;

          await supabase
            .from('google_locations')
            .update({
              total_reviews: totalReviews,
              average_rating: avgRating,
              updated_at: new Date().toISOString(),
            })
            .eq('id', location.id);
        }
      } catch (locationError) {
        const errorMessage = locationError instanceof Error
          ? locationError.message
          : 'Unknown error';
        errors.push(`${location.name}: ${errorMessage}`);
        console.error(`Failed to sync ${location.name}:`, locationError);
      }
    }

    return NextResponse.json({
      message: 'Sync completed',
      synced: totalSynced,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
