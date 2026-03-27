import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';

/**
 * POST /api/orders/[id]/cancel
 * Cancel an order and issue a refund if payment was captured. Auth required.
 *
 * Body: { reason?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = body.reason;
    } catch {
      // No body or invalid JSON is acceptable
    }

    // Fetch the order and verify ownership
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(
        `
        *,
        items:order_items(
          id,
          contractor_id,
          status
        )
        `
      )
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Only allow cancellation for pending or confirmed orders
    const cancellableStatuses = ['pending', 'confirmed'];
    if (!cancellableStatuses.includes(order.status)) {
      return NextResponse.json(
        {
          error: `Cannot cancel order with status '${order.status}'. Only pending or confirmed orders can be cancelled.`,
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    let newPaymentStatus = order.payment_status;

    // If payment was captured, initiate a full refund
    if (order.payment_status === 'captured' && order.stripe_payment_intent_id) {
      if (!stripe) {
        return NextResponse.json(
          { error: 'Stripe is not configured' },
          { status: 503 }
        );
      }

      try {
        await stripe.refunds.create({
          payment_intent: order.stripe_payment_intent_id,
        });
        newPaymentStatus = 'refunded';
      } catch (refundErr) {
        console.error('Failed to create Stripe refund:', refundErr);
        return NextResponse.json(
          { error: 'Failed to process refund' },
          { status: 500 }
        );
      }

      // Log refund transaction
      const { error: txError } = await supabase.from('transactions').insert({
        order_id: order.id,
        type: 'refund',
        amount: order.total,
        stripe_payment_intent_id: order.stripe_payment_intent_id,
        status: 'completed',
        description: `Full refund for cancelled order ${order.order_number}${reason ? `: ${reason}` : ''}`,
      });

      if (txError) {
        console.error('Failed to log refund transaction:', txError);
      }
    }

    // Update the order
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancelled_at: now,
        payment_status: newPaymentStatus,
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Failed to update order status:', updateError);
      return NextResponse.json(
        { error: 'Failed to cancel order' },
        { status: 500 }
      );
    }

    // Cancel all order items
    const { error: itemsError } = await supabase
      .from('order_items')
      .update({ status: 'cancelled' })
      .eq('order_id', orderId);

    if (itemsError) {
      console.error('Failed to cancel order items:', itemsError);
      // Non-fatal: order itself was cancelled
    }

    // Notify affected contractors
    const contractorIds = [
      ...new Set(
        (order.items || [])
          .filter(
            (item: { contractor_id: string; status: string }) =>
              item.status !== 'cancelled'
          )
          .map((item: { contractor_id: string }) => item.contractor_id)
      ),
    ];

    if (contractorIds.length > 0) {
      // Look up contractor user_ids
      const { data: contractors } = await supabase
        .from('contractors')
        .select('id, user_id')
        .in('id', contractorIds);

      if (contractors && contractors.length > 0) {
        const notifications = contractors
          .filter((c: { user_id: string | null }) => c.user_id)
          .map((c: { id: string; user_id: string }) => ({
            user_id: c.user_id,
            type: 'order_cancelled' as const,
            channel: 'in_app' as const,
            title: 'Order Cancelled',
            body: `Order ${order.order_number} has been cancelled by the homeowner.${reason ? ` Reason: ${reason}` : ''}`,
            reference_id: order.id,
            reference_type: 'order',
            sent_at: now,
          }));

        if (notifications.length > 0) {
          const { error: notifError } = await supabase
            .from('notifications')
            .insert(notifications);

          if (notifError) {
            console.error(
              'Failed to create contractor notifications:',
              notifError
            );
          }
        }
      }
    }

    return NextResponse.json({
      message: 'Order cancelled successfully',
      order_id: orderId,
      payment_status: newPaymentStatus,
      refunded: newPaymentStatus === 'refunded',
    });
  } catch (err) {
    console.error('Unexpected error in POST /api/orders/[id]/cancel:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
