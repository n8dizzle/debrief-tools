import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getGoogleBusinessClient } from '@/lib/google-business';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/reviews/[id]/reply
 * Create or update a reply to a Google review
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();

  // Check if user has permission to reply to reviews
  const { data: userData, error: userError } = await supabase
    .from('portal_users')
    .select('can_reply_reviews, role')
    .eq('email', session.user.email)
    .single();

  if (userError || !userData) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Allow owners/managers or users with explicit permission
  const canReply = userData.can_reply_reviews === true ||
    userData.role === 'owner' ||
    userData.role === 'manager';

  if (!canReply) {
    return NextResponse.json(
      { error: 'You do not have permission to reply to reviews' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { comment } = body;

    if (!comment || typeof comment !== 'string') {
      return NextResponse.json(
        { error: 'Reply comment is required' },
        { status: 400 }
      );
    }

    if (comment.length > 4096) {
      return NextResponse.json(
        { error: 'Reply exceeds maximum length of 4096 characters' },
        { status: 400 }
      );
    }

    // Get the review from database with location info
    const { data: review, error: reviewError } = await supabase
      .from('google_reviews')
      .select(`
        id,
        google_review_id,
        location_id,
        google_locations (
          google_account_id,
          google_location_id
        )
      `)
      .eq('id', id)
      .single();

    if (reviewError || !review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    const locations = review.google_locations as Array<{
      google_account_id: string;
      google_location_id: string;
    }> | null;
    const location = locations?.[0];

    if (!location?.google_account_id || !location?.google_location_id) {
      return NextResponse.json(
        { error: 'Location not properly configured' },
        { status: 400 }
      );
    }

    // Reply to the review via Google API
    const googleClient = getGoogleBusinessClient();

    if (!googleClient.isConfigured()) {
      return NextResponse.json(
        { error: 'Google Business Profile API not configured' },
        { status: 500 }
      );
    }

    const reply = await googleClient.replyToReview(
      location.google_account_id,
      location.google_location_id,
      review.google_review_id,
      comment
    );

    // Update local database with the reply
    const { error: updateError } = await supabase
      .from('google_reviews')
      .update({
        review_reply: comment,
        reply_time: reply.updateTime || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to update local review record:', updateError);
      // Don't fail - the reply was successfully posted to Google
    }

    return NextResponse.json({
      success: true,
      reply: {
        comment,
        updateTime: reply.updateTime,
      },
    });
  } catch (error) {
    console.error('Reply error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reply to review' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reviews/[id]/reply
 * Delete a reply from a Google review
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();

  // Check if user has permission to reply to reviews
  const { data: userData, error: userError } = await supabase
    .from('portal_users')
    .select('can_reply_reviews, role')
    .eq('email', session.user.email)
    .single();

  if (userError || !userData) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Allow owners/managers or users with explicit permission
  const canReply = userData.can_reply_reviews === true ||
    userData.role === 'owner' ||
    userData.role === 'manager';

  if (!canReply) {
    return NextResponse.json(
      { error: 'You do not have permission to delete replies' },
      { status: 403 }
    );
  }

  try {
    // Get the review from database with location info
    const { data: review, error: reviewError } = await supabase
      .from('google_reviews')
      .select(`
        id,
        google_review_id,
        location_id,
        google_locations (
          google_account_id,
          google_location_id
        )
      `)
      .eq('id', id)
      .single();

    if (reviewError || !review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    const locations = review.google_locations as Array<{
      google_account_id: string;
      google_location_id: string;
    }> | null;
    const location = locations?.[0];

    if (!location?.google_account_id || !location?.google_location_id) {
      return NextResponse.json(
        { error: 'Location not properly configured' },
        { status: 400 }
      );
    }

    // Delete the reply via Google API
    const googleClient = getGoogleBusinessClient();

    if (!googleClient.isConfigured()) {
      return NextResponse.json(
        { error: 'Google Business Profile API not configured' },
        { status: 500 }
      );
    }

    await googleClient.deleteReply(
      location.google_account_id,
      location.google_location_id,
      review.google_review_id
    );

    // Update local database to remove the reply
    const { error: updateError } = await supabase
      .from('google_reviews')
      .update({
        review_reply: null,
        reply_time: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to update local review record:', updateError);
      // Don't fail - the reply was successfully deleted from Google
    }

    return NextResponse.json({
      success: true,
      message: 'Reply deleted successfully',
    });
  } catch (error) {
    console.error('Delete reply error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete reply' },
      { status: 500 }
    );
  }
}
