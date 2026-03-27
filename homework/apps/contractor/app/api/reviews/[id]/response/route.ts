import { createServerClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

const getSupabaseServerClient = createServerClient;

// PUT /api/reviews/[id]/response - Respond to a review
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const { contractor_response } = body;

    if (!contractor_response || typeof contractor_response !== 'string' || contractor_response.trim().length === 0) {
      return NextResponse.json({ error: 'Response text is required' }, { status: 400 });
    }

    // Look up the review and verify the contractor_id matches
    const { data: review, error: findError } = await supabase
      .from('reviews')
      .select('id, contractor_id')
      .eq('id', id)
      .single();

    if (findError || !review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    if (review.contractor_id !== contractor.id) {
      return NextResponse.json({ error: 'You can only respond to reviews for your business' }, { status: 403 });
    }

    // Update the review with the contractor response
    const { data: updated, error: updateError } = await supabase
      .from('reviews')
      .update({
        contractor_response: contractor_response.trim(),
        contractor_responded_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ review: updated });
  } catch (err) {
    console.error('PUT /api/reviews/[id]/response error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
