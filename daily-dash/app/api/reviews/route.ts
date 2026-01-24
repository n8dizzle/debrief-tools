import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

/**
 * GET /api/reviews
 * Fetch reviews from database with filters
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const locationId = searchParams.get('locationId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const rating = searchParams.get('rating');
  const hasTeamMention = searchParams.get('hasTeamMention');
  const needsReply = searchParams.get('needsReply');
  const search = searchParams.get('search');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const supabase = getServerSupabase();

  let query = supabase
    .from('google_reviews')
    .select(`
      *,
      location:google_locations(id, name, short_name)
    `, { count: 'exact' })
    .order('create_time', { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply filters
  if (locationId) {
    query = query.eq('location_id', locationId);
  }

  if (startDate) {
    query = query.gte('create_time', startDate);
  }

  if (endDate) {
    query = query.lte('create_time', endDate);
  }

  if (rating) {
    query = query.eq('star_rating', parseInt(rating));
  }

  if (hasTeamMention === 'true') {
    query = query.not('team_members_mentioned', 'is', null)
      .filter('team_members_mentioned', 'neq', '{}');
  }

  if (needsReply === 'true') {
    query = query.is('review_reply', null);
  }

  // Search in comment and reviewer_name
  if (search && search.trim()) {
    const searchTerm = search.trim();
    query = query.or(`comment.ilike.%${searchTerm}%,reviewer_name.ilike.%${searchTerm}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    reviews: data,
    total: count,
    limit,
    offset,
  });
}
