import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey)
  : null;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
);

/**
 * POST /api/webhooks/stripe
 * Stripe webhook handler. No auth (uses Stripe signature verification).
 *
 * Handles:
 *   - payment_intent.succeeded: Mark order as captured, log transaction, notify homeowner
 *   - payment_intent.payment_failed: Mark order as failed, notify homeowner
 */
export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      console.error('Stripe is not configured');
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 503 }
      );
    }

    if (!stripeWebhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is not configured');
      return NextResponse.json(
        { error: 'Webhook secret is not configured' },
        { status: 503 }
      );
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        stripeWebhookSecret
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Webhook signature verification failed:', message);
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${message}` },
        { status: 400 }
      );
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent
        );
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent
        );
        break;

      default:
        // Unhandled event type — acknowledge receipt
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Unexpected error in Stripe webhook:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle payment_intent.succeeded:
 * - Update order payment_status to 'captured' and set paid_at
 * - Log a 'payment' transaction
 * - Create a notification for the homeowner
 */
async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
) {
  const orderId = paymentIntent.metadata?.order_id;
  if (!orderId) {
    console.error(
      'payment_intent.succeeded: Missing order_id in metadata',
      paymentIntent.id
    );
    return;
  }

  // Update order payment status
  const now = new Date().toISOString();
  const { data: order, error: updateError } = await supabaseAdmin
    .from('orders')
    .update({
      payment_status: 'captured',
      paid_at: now,
    })
    .eq('id', orderId)
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .select('id, order_number, user_id, total')
    .single();

  if (updateError || !order) {
    console.error(
      'payment_intent.succeeded: Failed to update order',
      orderId,
      updateError
    );
    return;
  }

  // Log payment transaction
  const { error: txError } = await supabaseAdmin
    .from('transactions')
    .insert({
      order_id: order.id,
      type: 'payment',
      amount: paymentIntent.amount,
      stripe_payment_intent_id: paymentIntent.id,
      status: 'completed',
      description: `Payment captured for order ${order.order_number}`,
    });

  if (txError) {
    console.error(
      'payment_intent.succeeded: Failed to log transaction',
      txError
    );
  }

  // Create notification for homeowner
  const { error: notifError } = await supabaseAdmin
    .from('notifications')
    .insert({
      user_id: order.user_id,
      type: 'payment_received',
      channel: 'in_app',
      title: 'Payment Confirmed',
      body: `Your payment of $${(order.total / 100).toFixed(2)} for order ${order.order_number} has been confirmed.`,
      reference_id: order.id,
      reference_type: 'order',
      sent_at: now,
    });

  if (notifError) {
    console.error(
      'payment_intent.succeeded: Failed to create notification',
      notifError
    );
  }
}

/**
 * Handle payment_intent.payment_failed:
 * - Update order payment_status to 'failed'
 * - Create a notification for the homeowner
 */
async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent
) {
  const orderId = paymentIntent.metadata?.order_id;
  if (!orderId) {
    console.error(
      'payment_intent.payment_failed: Missing order_id in metadata',
      paymentIntent.id
    );
    return;
  }

  // Update order payment status
  const { data: order, error: updateError } = await supabaseAdmin
    .from('orders')
    .update({
      payment_status: 'failed',
    })
    .eq('id', orderId)
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .select('id, order_number, user_id')
    .single();

  if (updateError || !order) {
    console.error(
      'payment_intent.payment_failed: Failed to update order',
      orderId,
      updateError
    );
    return;
  }

  // Determine failure reason
  const failureMessage =
    paymentIntent.last_payment_error?.message || 'Your payment was declined.';

  // Create notification for homeowner
  const { error: notifError } = await supabaseAdmin
    .from('notifications')
    .insert({
      user_id: order.user_id,
      type: 'system',
      channel: 'in_app',
      title: 'Payment Failed',
      body: `Payment for order ${order.order_number} failed: ${failureMessage}`,
      reference_id: order.id,
      reference_type: 'order',
      sent_at: new Date().toISOString(),
    });

  if (notifError) {
    console.error(
      'payment_intent.payment_failed: Failed to create notification',
      notifError
    );
  }
}
