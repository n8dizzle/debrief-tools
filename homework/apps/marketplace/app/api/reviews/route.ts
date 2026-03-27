import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/reviews
 * Get reviews for a service or contractor. Public - no auth required.
 *
 * Query params:
 *   service_id    - filter by service UUID
 *   contractor_id - filter by contractor UUID
 *   page          - page number (default 1)
 *   per_page      - results per page (default 20, max 50)
 *
 * At least one of service_id or contractor_id is required.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { searchParams } = request.nextUrl;

    const serviceId = searchParams.get('service_id');
    const contractorId = searchParams.get('contractor_id');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') || '20', 10)));

    if (!serviceId && !contractorId) {
      return NextResponse.json(
        { error: 'At least one of service_id or contractor_id is required' },
        { status: 400 }
      );
    }

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = supabase
      .from('reviews')
      .select(
        `
        id, rating_overall, rating_quality, rating_punctuality,
        rating_communication, rating_value, title, body, photos,
        contractor_response, created_at,
        reviewer:reviewer_id(id, raw_user_meta_data),
        service:catalog_services(id, name, slug),
        contractor:contractors(id, business_name, logo_url)
        `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (serviceId) {
      query = query.eq('service_id', serviceId);
    }
    if (contractorId) {
      query = query.eq('contractor_id', contractorId);
    }

    const { data: reviews, error, count } = await query;

    if (error) {
      console.error('Error fetching reviews:', error);
      return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
    }

    // Calculate aggregate stats
    let statsQuery = supabase
      .from('reviews')
      .select('rating_overall');

    if (serviceId) {
      statsQuery = statsQuery.eq('service_id', serviceId);
    }
    if (contractorId) {
      statsQuery = statsQuery.eq('contractor_id', contractorId);
    }

    const { data: allRatings } = await statsQuery;

    const stats = {
      total_reviews: count || 0,
      average_rating: 0,
      rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>,
    };

    if (allRatings && allRatings.length > 0) {
      const sum = allRatings.reduce((acc, r) => acc + (r.rating_overall || 0), 0);
      stats.average_rating = Math.round((sum / allRatings.length) * 10) / 10;
      for (const r of allRatings) {
        if (r.rating_overall >= 1 && r.rating_overall <= 5) {
          stats.rating_distribution[r.rating_overall]++;
        }
      }
    }

    return NextResponse.json({
      reviews: reviews || [],
      stats,
      pagination: {
        page,
        per_page: perPage,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / perPage),
      },
    });
  } catch (err) {
    console.error('Unexpected error in GET /api/reviews:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/reviews
 * Submit a review for a completed order item. Auth required.
 *
 * Body: { order_item_id, rating_overall (1-5), rating_quality? (1-5),
 *         rating_punctuality? (1-5), rating_communication? (1-5),
 *         rating_value? (1-5), title?, body?, photos? (string[]) }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.order_item_id) {
      return NextResponse.json({ error: 'order_item_id is required' }, { status: 400 });
    }
    if (!body.rating_overall || body.rating_overall < 1 || body.rating_overall > 5) {
      return NextResponse.json({ error: 'rating_overall is required and must be 1-5' }, { status: 400 });
    }

    // Validate optional ratings
    const ratingFields = ['rating_quality', 'rating_punctuality', 'rating_communication', 'rating_value'];
    for (const field of ratingFields) {
      if (body[field] !== undefined && (body[field] < 1 || body[field] > 5)) {
        return NextResponse.json({ error: `${field} must be 1-5` }, { status: 400 });
      }
    }

    // Verify the order item belongs to the user and is completed
    const { data: orderItem, error: orderItemError } = await supabase
      .from('order_items')
      .select(
        `
        id, service_id, contractor_id, status,
        order:orders!inner(user_id)
        `
      )
      .eq('id', body.order_item_id)
      .single();

    if (orderItemError || !orderItem) {
      return NextResponse.json({ error: 'Order item not found' }, { status: 404 });
    }

    const order = orderItem.order as unknown as { user_id: string };
    if (order.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (orderItem.status !== 'completed') {
      return NextResponse.json(
        { error: 'Can only review completed order items' },
        { status: 400 }
      );
    }

    // Check for existing review
    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('order_item_id', body.order_item_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'A review already exists for this order item' },
        { status: 409 }
      );
    }

    // Create the review
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .insert({
        order_item_id: body.order_item_id,
        reviewer_id: user.id,
        contractor_id: orderItem.contractor_id,
        service_id: orderItem.service_id,
        rating_overall: body.rating_overall,
        rating_quality: body.rating_quality || null,
        rating_punctuality: body.rating_punctuality || null,
        rating_communication: body.rating_communication || null,
        rating_value: body.rating_value || null,
        title: body.title || null,
        body: body.body || null,
        photos: body.photos || null,
      })
      .select()
      .single();

    if (reviewError) {
      console.error('Error creating review:', reviewError);
      return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
    }

    return NextResponse.json({ review }, { status: 201 });
  } catch (err) {
    console.error('Unexpected error in POST /api/reviews:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
