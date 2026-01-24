import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasPermission } from '@/lib/permissions';
import type { GBPPost, GBPPostTopicType } from '@/lib/supabase';

/**
 * GET /api/gbp/posts
 * List all GBP posts with their location status
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role, permissions } = session.user as {
    role: 'employee' | 'manager' | 'owner';
    permissions: any;
  };

  // Check permission
  if (!hasPermission(role, permissions, 'daily_dash', 'can_manage_gbp_posts')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const supabase = getServerSupabase();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  let query = supabase
    .from('gbp_posts')
    .select(`
      *,
      created_by_user:portal_users!created_by(id, name, email),
      locations:gbp_post_locations(
        *,
        location:google_locations(id, name, short_name)
      )
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Failed to fetch posts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    posts: data || [],
    total: count,
    limit,
    offset,
  });
}

/**
 * POST /api/gbp/posts
 * Create a new GBP post draft
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: userId, role, permissions } = session.user as {
    id: string;
    role: 'employee' | 'manager' | 'owner';
    permissions: any;
  };

  // Check permission
  if (!hasPermission(role, permissions, 'daily_dash', 'can_manage_gbp_posts')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = await request.json();
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

  // Validate required fields
  if (!summary || !topic_type) {
    return NextResponse.json(
      { error: 'Summary and topic_type are required' },
      { status: 400 }
    );
  }

  // Validate topic_type
  const validTopicTypes: GBPPostTopicType[] = ['STANDARD', 'EVENT', 'OFFER'];
  if (!validTopicTypes.includes(topic_type)) {
    return NextResponse.json(
      { error: 'Invalid topic_type. Must be STANDARD, EVENT, or OFFER' },
      { status: 400 }
    );
  }

  // Validate event fields
  if (topic_type === 'EVENT' && !event_title) {
    return NextResponse.json(
      { error: 'Event title is required for EVENT posts' },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('gbp_posts')
    .insert({
      summary,
      topic_type,
      cta_type: cta_type || null,
      cta_url: cta_url || null,
      event_title: event_title || null,
      event_start_date: event_start_date || null,
      event_end_date: event_end_date || null,
      coupon_code: coupon_code || null,
      redeem_url: redeem_url || null,
      terms_conditions: terms_conditions || null,
      media_urls: media_urls || [],
      status: 'draft',
      created_by: userId,
    })
    .select(`
      *,
      created_by_user:portal_users!created_by(id, name, email)
    `)
    .single();

  if (error) {
    console.error('Failed to create post:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
