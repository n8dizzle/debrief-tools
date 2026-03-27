import { createServerClient } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';
import { NextResponse } from 'next/server';

// GET /api/stripe-connect/status - Check Stripe Connect account status
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
      return NextResponse.json({
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        requirements: null,
      });
    }

    // Retrieve the Stripe account
    const account = await stripe.accounts.retrieve(contractor.stripe_account_id);

    // Update the contractor record with latest status
    const { error: updateError } = await supabase
      .from('contractors')
      .update({
        stripe_charges_enabled: account.charges_enabled,
        stripe_payouts_enabled: account.payouts_enabled,
      })
      .eq('id', contractor.id);

    if (updateError) {
      console.error('Failed to update Stripe status:', updateError);
    }

    return NextResponse.json({
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      requirements: account.requirements,
    });
  } catch (err) {
    console.error('GET /api/stripe-connect/status error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
