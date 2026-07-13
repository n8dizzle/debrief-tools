import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/reviews?limit=5&install=true&city=Bartonville
// Pulls real Google reviews from all GBP locations in Supabase
// Prioritizes: install-related, 5-star, customer's city, recent
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '30');
  const installOnly = searchParams.get('install') !== 'false';
  const keyword = searchParams.get('keyword') || '';
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
      // Tight filter: HVAC install-specific keywords only
      query = query.or(
        'comment.ilike.%new ac%,comment.ilike.%new air conditioner%,comment.ilike.%new system%,comment.ilike.%new unit%,comment.ilike.%replacement system%,comment.ilike.%install team%,comment.ilike.%install crew%,comment.ilike.%comfort advisor%,comment.ilike.%new a/c%,comment.ilike.%replaced our%,comment.ilike.%brand new%'
      );
    }

    // Pull more than we need so we can filter out non-HVAC and prioritize by city
    const { data, error } = await query.limit(100);

    if (error) throw new Error(error.message);

    // Post-filter: exclude maintenance, water heater, plumbing, repair-only reviews
    const excludePatterns = /water heater|tankless|plumbing|plumber|drain|sewer|maintenance visit|tune.?up|repair(?:ed|s)?\s/i;
    const filtered = (data || []).filter(r => !excludePatterns.test(r.comment || ''));

    let reviews = filtered.map(r => ({
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
