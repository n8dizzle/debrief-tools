import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/notifications
 * List the authenticated user's notifications with pagination.
 *
 * Query params:
 *   page        - page number (default 1)
 *   per_page    - results per page (default 20, max 50)
 *   unread_only - if "true", only return unread notifications
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get('per_page') || '20', 10))
    );
    const unreadOnly = searchParams.get('unread_only') === 'true';

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error, count } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json(
        { error: 'Failed to fetch notifications' },
        { status: 500 }
      );
    }

    // Also fetch total unread count (always useful for badges)
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    return NextResponse.json({
      notifications: notifications || [],
      unread_count: unreadCount || 0,
      pagination: {
        page,
        per_page: perPage,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / perPage),
      },
    });
  } catch (err) {
    console.error('Unexpected error in GET /api/notifications:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications
 * Mark notifications as read.
 *
 * Body (one of):
 *   { notification_ids: string[] }  - mark specific notifications as read
 *   { mark_all: true }              - mark ALL of the user's notifications as read
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const now = new Date().toISOString();

    if (body.mark_all === true) {
      // Mark all unread notifications as read for this user
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: now })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking all notifications read:', error);
        return NextResponse.json(
          { error: 'Failed to mark notifications as read' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, marked: 'all' });
    }

    if (
      Array.isArray(body.notification_ids) &&
      body.notification_ids.length > 0
    ) {
      // Mark specific notifications as read (only if they belong to this user)
      const { data: updated, error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: now })
        .eq('user_id', user.id)
        .in('id', body.notification_ids)
        .select('id');

      if (error) {
        console.error('Error marking notifications read:', error);
        return NextResponse.json(
          { error: 'Failed to mark notifications as read' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        marked_ids: (updated || []).map((n) => n.id),
      });
    }

    return NextResponse.json(
      { error: 'Provide notification_ids array or mark_all: true' },
      { status: 400 }
    );
  } catch (err) {
    console.error('Unexpected error in POST /api/notifications:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
