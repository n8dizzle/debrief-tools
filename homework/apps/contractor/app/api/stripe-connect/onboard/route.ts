import { createServerClient } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';
import { NextResponse } from 'next/server';

// POST /api/stripe-connect/onboard - Create or continue Stripe Connect onboarding
export async function POST() {
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
      .select('id, stripe_account_id, email, business_name, owner_name')
      .eq('user_id', user.id)
      .single();

    if (contractorError || !contractor) {
      return NextResponse.json({ error: 'Contractor profile not found' }, { status: 404 });
    }

    let stripeAccountId = contractor.stripe_account_id;

    // If no Stripe account exists yet, create one
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: contractor.email || user.email || undefined,
        business_type: 'individual',
        metadata: {
          contractor_id: contractor.id,
          user_id: user.id,
        },
      });

      stripeAccountId = account.id;

      // Save the stripe_account_id to the contractor record
      const { error: updateError } = await supabase
        .from('contractors')
        .update({ stripe_account_id: stripeAccountId })
        .eq('id', contractor.id);

      if (updateError) {
        console.error('Failed to save stripe_account_id:', updateError);
        return NextResponse.json({ error: 'Failed to save Stripe account' }, { status: 500 });
      }
    }

    // Build return/refresh URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3101';
    const returnUrl = `${baseUrl}/payouts`;
    const refreshUrl = `${baseUrl}/payouts`;

    // Create an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      return_url: returnUrl,
      refresh_url: refreshUrl,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err) {
    console.error('POST /api/stripe-connect/onboard error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
