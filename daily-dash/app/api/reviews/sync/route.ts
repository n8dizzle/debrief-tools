import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import {
  getGoogleBusinessClient,
  starRatingToNumber,
  findTeamMemberMentionsAI,
  GoogleReview,
  TeamMember,
} from '@/lib/google-business';

/**
 * POST /api/reviews/sync
 * Sync reviews from Google Business Profile API
 * Supports both session auth (manual) and cron auth (scheduled)
 */
export async function POST(request: NextRequest) {
  // Check for cron secret (for scheduled jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  // If not cron auth, check session
  if (!isCronAuth) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has owner/manager role
    const { role } = session.user as { role?: string };
    if (role !== 'owner' && role !== 'manager') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
  }

  const syncSource = isCronAuth ? 'cron' : 'manual';
  console.log(`[Reviews Sync] Starting ${syncSource} sync at ${new Date().toISOString()}`);

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
      .select('name, aliases, slack_user_id')
      .eq('is_active', true);

    let totalSynced = 0;
    let newReviewsWithMentions: Array<{
      reviewId: string;
      reviewerName: string;
      starRating: number;
      comment: string;
      locationName: string;
      teamMentions: string[];
      slackUserIds: string[];
    }> = [];
    const errors: string[] = [];

    // Get existing review IDs to detect new reviews (AI only runs once per review)
    const { data: existingReviews } = await supabase
      .from('google_reviews')
      .select('google_review_id');
    const existingReviewIds = new Set(existingReviews?.map(r => r.google_review_id) || []);

    // Sync reviews for each location
    for (const location of locations) {
      try {
        const reviews = await googleClient.getAllReviews(
          location.google_account_id,
          location.google_location_id
        );

        // Process and upsert reviews
        for (const review of reviews) {
          const isNewReview = !existingReviewIds.has(review.reviewId);

          // Use AI-powered detection ONLY for brand new reviews (never re-run on existing reviews)
          let teamMentions: string[] = [];
          if (isNewReview && review.comment && teamMembers && teamMembers.length > 0) {
            teamMentions = await findTeamMemberMentionsAI(
              review.comment,
              teamMembers as TeamMember[]
            );
          }

          // Count photos and videos from media array
          const photoCount = review.media?.filter(m => m.mediaFormat === 'PHOTO').length || 0;
          const videoCount = review.media?.filter(m => m.mediaFormat === 'VIDEO').length || 0;

          // Build review data - exclude team_members_mentioned if it was manually reviewed
          const reviewData: Record<string, unknown> = {
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
            media: review.media || null,
            photo_count: photoCount,
            video_count: videoCount,
            is_processed: true,
            updated_at: new Date().toISOString(),
          };

          // Only set team_members_mentioned for NEW reviews (never overwrite existing)
          if (isNewReview) {
            reviewData.team_members_mentioned = teamMentions.length > 0 ? teamMentions : null;
          }

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

            // Track new reviews with team mentions for Slack notifications
            if (isNewReview && teamMentions.length > 0 && teamMembers) {
              const slackUserIds = teamMembers
                .filter(m => teamMentions.includes(m.name) && m.slack_user_id)
                .map(m => m.slack_user_id as string);

              if (slackUserIds.length > 0) {
                newReviewsWithMentions.push({
                  reviewId: review.reviewId,
                  reviewerName: review.reviewer?.displayName || 'Anonymous',
                  starRating: starRatingToNumber(review.starRating),
                  comment: review.comment || '',
                  locationName: location.name,
                  teamMentions,
                  slackUserIds,
                });
              }
            }
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

    // Send Slack notifications for new reviews with team mentions
    // (Slack client will be added in Phase 3)
    if (newReviewsWithMentions.length > 0 && process.env.SLACK_ENABLED === 'true') {
      try {
        // Dynamic import to avoid errors if slack.ts doesn't exist yet
        const { sendReviewMentionNotifications } = await import('@/lib/slack');
        await sendReviewMentionNotifications(newReviewsWithMentions);
      } catch (slackError) {
        console.error('Failed to send Slack notifications:', slackError);
        // Don't fail the sync if Slack notifications fail
      }
    }

    return NextResponse.json({
      message: 'Sync completed',
      syncSource,
      synced: totalSynced,
      newMentions: newReviewsWithMentions.length,
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
