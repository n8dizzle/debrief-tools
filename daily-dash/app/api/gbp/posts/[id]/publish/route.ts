import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasPermission } from '@/lib/permissions';
import {
  getGoogleBusinessClient,
  CreateLocalPostRequest,
  LocalPostCallToAction,
} from '@/lib/google-business';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper to convert date string to Google date format
function toGoogleDate(dateStr: string): { year: number; month: number; day: number } {
  const date = new Date(dateStr);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

// Map CTA type to Google action type
function mapCtaType(ctaType: string | null): LocalPostCallToAction['actionType'] | null {
  if (!ctaType) return null;
  const mapping: Record<string, LocalPostCallToAction['actionType']> = {
    'BOOK': 'BOOK',
    'ORDER': 'ORDER',
    'SHOP': 'SHOP',
    'LEARN_MORE': 'LEARN_MORE',
    'SIGN_UP': 'SIGN_UP',
    'GET_OFFER': 'GET_OFFER',
    'CALL': 'CALL',
  };
  return mapping[ctaType] || null;
}

/**
 * POST /api/gbp/posts/[id]/publish
 * Publish a post to all configured Google Business locations
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role, permissions } = session.user as {
    role: 'employee' | 'manager' | 'owner';
    permissions: any;
  };

  if (!hasPermission(role, permissions, 'daily_dash', 'can_manage_gbp_posts')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();
  const gbClient = getGoogleBusinessClient();

  if (!gbClient.isConfigured()) {
    return NextResponse.json(
      { error: 'Google Business Profile API not configured' },
      { status: 500 }
    );
  }

  // Get the post
  const { data: post, error: fetchError } = await supabase
    .from('gbp_posts')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (post.status === 'published') {
    return NextResponse.json(
      { error: 'Post already published' },
      { status: 400 }
    );
  }

  // Get all configured locations
  const { data: locations, error: locError } = await supabase
    .from('google_locations')
    .select('*')
    .not('google_account_id', 'is', null)
    .not('google_location_id', 'is', null)
    .order('display_order');

  if (locError) {
    return NextResponse.json({ error: locError.message }, { status: 500 });
  }

  if (!locations || locations.length === 0) {
    return NextResponse.json(
      { error: 'No configured Google Business locations found' },
      { status: 400 }
    );
  }

  // Update post status to publishing
  await supabase
    .from('gbp_posts')
    .update({ status: 'publishing', updated_at: new Date().toISOString() })
    .eq('id', id);

  // Build the post request
  const postRequest: CreateLocalPostRequest = {
    summary: post.summary,
    topicType: post.topic_type,
  };

  // Add CTA if provided
  const ctaActionType = mapCtaType(post.cta_type);
  if (ctaActionType && post.cta_url) {
    postRequest.callToAction = {
      actionType: ctaActionType,
      url: post.cta_url,
    };
  } else if (ctaActionType === 'CALL') {
    postRequest.callToAction = {
      actionType: 'CALL',
    };
  }

  // Add media if provided
  if (post.media_urls && post.media_urls.length > 0) {
    postRequest.media = post.media_urls.map((url: string) => ({
      mediaFormat: 'PHOTO' as const,
      sourceUrl: url,
    }));
  }

  // Add event details for EVENT posts
  if (post.topic_type === 'EVENT' && post.event_title) {
    const startDate = post.event_start_date
      ? toGoogleDate(post.event_start_date)
      : toGoogleDate(new Date().toISOString());
    const endDate = post.event_end_date
      ? toGoogleDate(post.event_end_date)
      : startDate;

    postRequest.event = {
      title: post.event_title,
      schedule: {
        startDate,
        endDate,
      },
    };
  }

  // Add offer details for OFFER posts
  if (post.topic_type === 'OFFER') {
    postRequest.offer = {};
    if (post.coupon_code) {
      postRequest.offer.couponCode = post.coupon_code;
    }
    if (post.redeem_url) {
      postRequest.offer.redeemOnlineUrl = post.redeem_url;
    }
    if (post.terms_conditions) {
      postRequest.offer.termsConditions = post.terms_conditions;
    }
  }

  // Create location records
  const locationRecords = locations.map((loc) => ({
    post_id: id,
    location_id: loc.id,
    status: 'pending',
  }));

  await supabase.from('gbp_post_locations').insert(locationRecords);

  // Publish to each location with rate limiting
  const results: Array<{
    locationId: string;
    locationName: string;
    success: boolean;
    googlePostId?: string;
    googlePostUrl?: string;
    error?: string;
  }> = [];

  for (const location of locations) {
    try {
      // Update status to publishing
      await supabase
        .from('gbp_post_locations')
        .update({ status: 'publishing' })
        .eq('post_id', id)
        .eq('location_id', location.id);

      // Create the post
      const result = await gbClient.createLocalPost(
        location.google_account_id,
        location.google_location_id,
        postRequest
      );

      // Extract post ID from the name (format: accounts/.../locations/.../localPosts/...)
      const googlePostId = result.name?.split('/').pop() || null;

      // Update location record with success
      await supabase
        .from('gbp_post_locations')
        .update({
          status: 'published',
          google_post_id: googlePostId,
          google_post_url: result.searchUrl || null,
          state: result.state || null,
          published_at: new Date().toISOString(),
        })
        .eq('post_id', id)
        .eq('location_id', location.id);

      results.push({
        locationId: location.id,
        locationName: location.short_name,
        success: true,
        googlePostId: googlePostId || undefined,
        googlePostUrl: result.searchUrl || undefined,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to publish to ${location.short_name}:`, errorMessage);

      // Update location record with failure
      await supabase
        .from('gbp_post_locations')
        .update({
          status: 'failed',
          error_message: errorMessage,
        })
        .eq('post_id', id)
        .eq('location_id', location.id);

      results.push({
        locationId: location.id,
        locationName: location.short_name,
        success: false,
        error: errorMessage,
      });
    }

    // Rate limit: 1 second between requests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Determine final status
  const successCount = results.filter((r) => r.success).length;
  const finalStatus = successCount === 0 ? 'failed' : 'published';

  // Update post status
  await supabase
    .from('gbp_posts')
    .update({
      status: finalStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  return NextResponse.json({
    success: successCount > 0,
    total: locations.length,
    published: successCount,
    failed: locations.length - successCount,
    results,
  });
}
