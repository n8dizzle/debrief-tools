import { createServerClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

const getSupabaseServerClient = createServerClient;

// GET /api/reviews - List reviews for the authenticated contractor
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: contractor, error: contractorError } = await supabase
      .from('contractors')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (contractorError || !contractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const { searchParams } = request.nextUrl;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const { data: reviews, error, count } = await supabase
      .from('reviews')
      .select(
        `
        id,
        rating_overall,
        rating_quality,
        rating_punctuality,
        rating_communication,
        rating_value,
        title,
        body,
        photos,
        contractor_response,
        contractor_responded_at,
        created_at,
        reviewer:reviewer_id(id, raw_user_meta_data),
        service:catalog_services!service_id(id, name, slug)
      `,
        { count: 'exact' }
      )
      .eq('contractor_id', contractor.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reviews: reviews || [], total: count });
  } catch (err) {
    console.error('GET /api/reviews error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
