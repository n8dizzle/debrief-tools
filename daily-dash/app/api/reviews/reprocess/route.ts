import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import {
  findTeamMemberMentionsAI,
  TeamMember,
} from '@/lib/google-business';

/**
 * POST /api/reviews/reprocess
 * Re-run AI-powered employee detection on existing reviews
 * Useful for populating mentions on historical reviews after adding new team members
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user has owner role
  const { role } = session.user as { role?: string };
  if (role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can reprocess reviews' }, { status: 403 });
  }

  const supabase = getServerSupabase();

  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(body.limit || 100, 500); // Max 500 per request
    const onlyEmpty = body.onlyEmpty !== false; // Default: only process reviews without existing mentions
    const startDate = body.startDate; // Optional: only process reviews after this date
    const endDate = body.endDate; // Optional: only process reviews before this date

    // Get team members for mention detection
    const { data: teamMembers, error: teamError } = await supabase
      .from('team_members')
      .select('name, aliases')
      .eq('is_active', true);

    if (teamError || !teamMembers || teamMembers.length === 0) {
      return NextResponse.json({
        error: 'No active team members found',
      }, { status: 400 });
    }

    // Build query for reviews to reprocess
    // NEVER reprocess reviews that have been manually reviewed (mentions_reviewed = true)
    let query = supabase
      .from('google_reviews')
      .select('id, google_review_id, comment')
      .not('comment', 'is', null)
      .or('mentions_reviewed.is.null,mentions_reviewed.eq.false')
      .order('create_time', { ascending: false })
      .limit(limit);

    if (onlyEmpty) {
      query = query.is('team_members_mentioned', null);
    }

    if (startDate) {
      query = query.gte('create_time', startDate);
    }

    if (endDate) {
      query = query.lte('create_time', endDate);
    }

    const { data: reviews, error: reviewsError } = await query;

    if (reviewsError) {
      throw new Error(`Failed to fetch reviews: ${reviewsError.message}`);
    }

    if (!reviews || reviews.length === 0) {
      return NextResponse.json({
        message: 'No reviews to process',
        processed: 0,
        updated: 0,
      });
    }

    let processed = 0;
    let updated = 0;
    const errors: string[] = [];

    // Process reviews one at a time to avoid overwhelming the AI API
    for (const review of reviews) {
      if (!review.comment) continue;

      try {
        const mentions = await findTeamMemberMentionsAI(
          review.comment,
          teamMembers as TeamMember[]
        );

        const { error: updateError } = await supabase
          .from('google_reviews')
          .update({
            team_members_mentioned: mentions.length > 0 ? mentions : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', review.id);

        if (updateError) {
          errors.push(`Failed to update review ${review.google_review_id}: ${updateError.message}`);
        } else {
          processed++;
          if (mentions.length > 0) {
            updated++;
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to process review ${review.google_review_id}: ${message}`);
      }
    }

    return NextResponse.json({
      message: 'Reprocessing completed',
      processed,
      updated,
      total: reviews.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Reprocess error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Reprocess failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reviews/reprocess
 * Get count of reviews that would be reprocessed
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const searchParams = request.nextUrl.searchParams;
  const onlyEmpty = searchParams.get('onlyEmpty') !== 'false';

  try {
    let query = supabase
      .from('google_reviews')
      .select('id', { count: 'exact', head: true })
      .not('comment', 'is', null);

    if (onlyEmpty) {
      query = query.is('team_members_mentioned', null);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Failed to count reviews: ${error.message}`);
    }

    return NextResponse.json({
      eligibleReviews: count || 0,
      onlyEmpty,
    });
  } catch (error) {
    console.error('Reprocess count error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to count reviews' },
      { status: 500 }
    );
  }
}
