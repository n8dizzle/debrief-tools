import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/reviews?limit=5&install=true&city=Bartonville
// Pulls real Google reviews from all GBP locations in Supabase
// Prioritizes: install-related, 5-star, customer's city, recent
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '3');
  const installOnly = searchParams.get('install') !== 'false';
  const city = searchParams.get('city') || '';

  try {
    const supabase = getServerSupabase();

    // Build the base query — all 5-star reviews with comments across all locations
    let query = supabase
      .from('google_reviews')
      .select('reviewer_name, star_rating, comment, create_time, location:google_locations(name, short_name)')
      .eq('star_rating', 5)
      .not('comment', 'is', null)
      .order('create_time', { ascending: false });

    if (installOnly) {
      query = query.or(
        'comment.ilike.%install%,comment.ilike.%new system%,comment.ilike.%replacement%,comment.ilike.%new unit%,comment.ilike.%new ac%,comment.ilike.%new air conditioner%,comment.ilike.%hvac%,comment.ilike.%furnace%,comment.ilike.%heat pump%,comment.ilike.%comfort advisor%,comment.ilike.%estimate%,comment.ilike.%new equipment%'
      );
    }

    // Pull more than we need so we can prioritize by city
    const { data, error } = await query.limit(50);

    if (error) throw new Error(error.message);

    let reviews = (data || []).map(r => ({
      name: r.reviewer_name || 'Anonymous',
      rating: r.star_rating,
      text: r.comment,
      date: new Date(r.create_time).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      locationName: (r.location as any)?.short_name || (r.location as any)?.name || '',
      // Check if review mentions the customer's city
      isLocal: city ? (r.comment || '').toLowerCase().includes(city.toLowerCase()) : false,
    }));

    // Sort: local reviews first, then by recency (already sorted by create_time desc)
    if (city) {
      reviews.sort((a, b) => {
        if (a.isLocal && !b.isLocal) return -1;
        if (!a.isLocal && b.isLocal) return 1;
        return 0;
      });
    }

    // Take the top N
    reviews = reviews.slice(0, limit);

    return NextResponse.json({ reviews });
  } catch (err) {
    console.error('[Reviews] Error:', err);
    // Return placeholder reviews as fallback
    return NextResponse.json({
      reviews: [
        { name: 'Recent Customer', rating: 5, text: 'Great installation experience. The team was professional and thorough.', date: 'Recent', locationName: '', isLocal: false },
      ],
    });
  }
}
