import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasPermission } from '@/lib/permissions';
import { getGoogleBusinessClient } from '@/lib/google-business';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/gbp/posts/[id]
 * Get a single post with its location status
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

  const { data, error } = await supabase
    .from('gbp_posts')
    .select(`
      *,
      created_by_user:portal_users!created_by(id, name, email),
      locations:gbp_post_locations(
        *,
        location:google_locations(id, name, short_name, google_account_id, google_location_id)
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    console.error('Failed to fetch post:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/gbp/posts/[id]
 * Update a post (only if draft)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
  const body = await request.json();
  const supabase = getServerSupabase();

  // Check if post exists and is still a draft
  const { data: existingPost, error: fetchError } = await supabase
    .from('gbp_posts')
    .select('status')
    .eq('id', id)
    .single();

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (existingPost.status !== 'draft') {
    return NextResponse.json(
      { error: 'Can only edit draft posts' },
      { status: 400 }
    );
  }

  const {
    summary,
    topic_type,
    cta_type,
    cta_url,
    event_title,
    event_start_date,
    event_end_date,
    coupon_code,
    redeem_url,
    terms_conditions,
    media_urls,
  } = body;

  const { data, error } = await supabase
    .from('gbp_posts')
    .update({
      ...(summary !== undefined && { summary }),
      ...(topic_type !== undefined && { topic_type }),
      ...(cta_type !== undefined && { cta_type }),
      ...(cta_url !== undefined && { cta_url }),
      ...(event_title !== undefined && { event_title }),
      ...(event_start_date !== undefined && { event_start_date }),
      ...(event_end_date !== undefined && { event_end_date }),
      ...(coupon_code !== undefined && { coupon_code }),
      ...(redeem_url !== undefined && { redeem_url }),
      ...(terms_conditions !== undefined && { terms_conditions }),
      ...(media_urls !== undefined && { media_urls }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      *,
      created_by_user:portal_users!created_by(id, name, email)
    `)
    .single();

  if (error) {
    console.error('Failed to update post:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/gbp/posts/[id]
 * Delete a post and remove from Google if published
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

  // Get post with its location records
  const { data: post, error: fetchError } = await supabase
    .from('gbp_posts')
    .select(`
      *,
      locations:gbp_post_locations(
        *,
        location:google_locations(google_account_id, google_location_id)
      )
    `)
    .eq('id', id)
    .single();

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  // If post was published, try to delete from Google
  if (post.status === 'published' && post.locations) {
    const gbClient = getGoogleBusinessClient();

    if (gbClient.isConfigured()) {
      const deletePromises = post.locations
        .filter((loc: any) => loc.google_post_id && loc.location?.google_account_id && loc.location?.google_location_id)
        .map(async (loc: any) => {
          try {
            await gbClient.deleteLocalPost(
              loc.location.google_account_id,
              loc.location.google_location_id,
              loc.google_post_id
            );
            return { locationId: loc.location_id, success: true };
          } catch (error) {
            console.error(`Failed to delete post from Google for location ${loc.location_id}:`, error);
            return { locationId: loc.location_id, success: false, error };
          }
        });

      // Wait for all delete attempts (don't fail if some don't work)
      await Promise.all(deletePromises);
    }
  }

  // Delete from database (cascades to gbp_post_locations)
  const { error: deleteError } = await supabase
    .from('gbp_posts')
    .delete()
    .eq('id', id);

  if (deleteError) {
    console.error('Failed to delete post:', deleteError);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
