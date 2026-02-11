import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/reviews/[id]/mentions
 * Update team members mentioned on a review
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();

  // Check if user has permission (owner/manager or can_reply_reviews)
  const { data: userData, error: userError } = await supabase
    .from('portal_users')
    .select('can_reply_reviews, role')
    .eq('email', session.user.email)
    .single();

  if (userError || !userData) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const canEdit = userData.can_reply_reviews === true ||
    userData.role === 'owner' ||
    userData.role === 'manager';

  if (!canEdit) {
    return NextResponse.json(
      { error: 'You do not have permission to edit mentions' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { mentions } = body;

    // Validate mentions is an array of strings (or null/empty to clear)
    if (mentions !== null && !Array.isArray(mentions)) {
      return NextResponse.json(
        { error: 'Mentions must be an array of names' },
        { status: 400 }
      );
    }

    if (mentions && !mentions.every((m: unknown) => typeof m === 'string')) {
      return NextResponse.json(
        { error: 'All mentions must be strings' },
        { status: 400 }
      );
    }

    // Clean up mentions - trim whitespace, remove empty strings
    const cleanedMentions = mentions
      ? mentions.map((m: string) => m.trim()).filter((m: string) => m.length > 0)
      : [];

    // Write to confirmed_mentions (human-confirmed), never touch team_members_mentioned (AI-detected).
    // Use empty array [] when user clears all mentions (not NULL, which means "not yet confirmed").
    const { data, error: updateError } = await supabase
      .from('google_reviews')
      .update({
        confirmed_mentions: cleanedMentions,
        confirmed_at: new Date().toISOString(),
        confirmed_by: session.user.email,
        mentions_reviewed: true, // backward compat
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, team_members_mentioned, confirmed_mentions, mentions_reviewed')
      .single();

    if (updateError) {
      console.error('Failed to update mentions:', updateError);
      return NextResponse.json(
        { error: `Failed to update mentions: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      review: data,
    });
  } catch (error) {
    console.error('Update mentions error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update mentions' },
      { status: 500 }
    );
  }
}
