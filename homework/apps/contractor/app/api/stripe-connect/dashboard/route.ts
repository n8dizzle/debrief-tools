import { createServerClient } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';
import { NextResponse } from 'next/server';

// GET /api/stripe-connect/dashboard - Get Stripe Express Dashboard login link
export async function GET() {
  try {
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get contractor record
    const { data: contractor, error: contractorError } = await supabase
      .from('contractors')
      .select('id, stripe_account_id')
      .eq('user_id', user.id)
      .single();

    if (contractorError || !contractor) {
      return NextResponse.json({ error: 'Contractor profile not found' }, { status: 404 });
    }

    if (!contractor.stripe_account_id) {
      return NextResponse.json({ error: 'No Stripe account connected' }, { status: 400 });
    }

    // Create a login link for the Express dashboard
    const loginLink = await stripe.accounts.createLoginLink(contractor.stripe_account_id);

    return NextResponse.json({ url: loginLink.url });
  } catch (err) {
    console.error('GET /api/stripe-connect/dashboard error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
