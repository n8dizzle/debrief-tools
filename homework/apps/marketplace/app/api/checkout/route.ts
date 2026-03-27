import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';
import type Stripe from 'stripe';

/**
 * POST /api/checkout
 * Create a Stripe PaymentIntent for an existing order. Auth required.
 *
 * Body: { order_id: string }
 *
 * Returns: { client_secret: string }
 */
export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 503 }
      );
    }

    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { order_id } = body;

    if (!order_id) {
      return NextResponse.json(
        { error: 'order_id is required' },
        { status: 400 }
      );
    }

    // Fetch the order and verify ownership + eligibility
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(
        `
        *,
        items:order_items(
          id,
          contractor_id
        )
        `
      )
      .eq('id', order_id)
      .eq('user_id', user.id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status !== 'pending') {
      return NextResponse.json(
        { error: `Order is not pending (current status: ${order.status})` },
        { status: 400 }
      );
    }

    if (order.payment_status !== 'pending') {
      return NextResponse.json(
        {
          error: `Payment is not pending (current status: ${order.payment_status})`,
        },
        { status: 400 }
      );
    }

    // Determine if multiple contractors are involved (for transfer_group)
    const contractorIds = new Set(
      (order.items || []).map(
        (item: { contractor_id: string }) => item.contractor_id
      )
    );
    const hasMultipleContractors = contractorIds.size > 1;

    // Build PaymentIntent params
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: order.total, // Already in cents
      currency: 'usd',
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
        user_id: user.id,
      },
      ...(hasMultipleContractors ? { transfer_group: order.id } : {}),
    };

    // Create the Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    // Update the order with the PaymentIntent ID and status
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        payment_status: 'authorized',
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('Error updating order with PaymentIntent:', updateError);
      // Cancel the PaymentIntent since we failed to record it
      await stripe.paymentIntents.cancel(paymentIntent.id);
      return NextResponse.json(
        { error: 'Failed to update order' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error('Unexpected error in POST /api/checkout:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
