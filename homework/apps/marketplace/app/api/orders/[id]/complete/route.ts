import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';

/**
 * POST /api/orders/[id]/complete
 * Complete an order and initiate contractor payouts via Stripe transfers.
 * Auth required (homeowner).
 *
 * Prerequisites:
 *   - All order_items must have status='completed'
 *   - Order must be owned by the authenticated user
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

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

    // Fetch the order with items and contractor details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(
        `
        *,
        items:order_items(
          id,
          status,
          contractor_payout,
          platform_fee,
          contractor_id,
          contractor:contractors(id, business_name, user_id, stripe_account_id)
        )
        `
      )
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status === 'completed') {
      return NextResponse.json(
        { error: 'Order is already completed' },
        { status: 400 }
      );
    }

    if (order.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot complete a cancelled order' },
        { status: 400 }
      );
    }

    // Verify all items are completed
    const items = order.items || [];
    const incompleteItems = items.filter(
      (item: { status: string }) => item.status !== 'completed'
    );

    if (incompleteItems.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot complete order: ${incompleteItems.length} item(s) are not yet completed`,
          incomplete_items: incompleteItems.map(
            (item: { id: string; status: string }) => ({
              id: item.id,
              status: item.status,
            })
          ),
        },
        { status: 400 }
      );
    }

    // Process payouts for each order item with a connected contractor
    let totalPlatformFees = 0;
    const transferResults: Array<{
      item_id: string;
      transfer_id: string | null;
      error: string | null;
    }> = [];

    for (const item of items) {
      const contractor = item.contractor as {
        id: string;
        business_name: string;
        user_id: string | null;
        stripe_account_id: string | null;
      } | null;

      totalPlatformFees += item.platform_fee || 0;

      if (!contractor?.stripe_account_id) {
        transferResults.push({
          item_id: item.id,
          transfer_id: null,
          error: contractor
            ? 'Contractor has no Stripe account connected'
            : 'No contractor assigned',
        });
        continue;
      }

      try {
        // Create Stripe Transfer to contractor's connected account
        const transferParams: Stripe.TransferCreateParams = {
          amount: item.contractor_payout, // Already in cents
          currency: 'usd',
          destination: contractor.stripe_account_id,
          transfer_group: order.id,
          metadata: {
            order_id: order.id,
            order_number: order.order_number,
            order_item_id: item.id,
            contractor_id: contractor.id,
          },
        };

        const transfer = await stripe.transfers.create(transferParams);

        // Update order item with transfer info
        const { error: itemUpdateError } = await supabase
          .from('order_items')
          .update({
            stripe_transfer_id: transfer.id,
            payout_status: 'processing',
          })
          .eq('id', item.id);

        if (itemUpdateError) {
          console.error(
            `Failed to update order item ${item.id} with transfer:`,
            itemUpdateError
          );
        }

        // Log contractor payout transaction
        const { error: txError } = await supabase
          .from('transactions')
          .insert({
            order_id: order.id,
            order_item_id: item.id,
            type: 'contractor_payout',
            amount: item.contractor_payout,
            stripe_transfer_id: transfer.id,
            status: 'processing',
            description: `Payout to ${contractor.business_name} for order ${order.order_number}`,
          });

        if (txError) {
          console.error(
            `Failed to log payout transaction for item ${item.id}:`,
            txError
          );
        }

        // Notify contractor about payout
        if (contractor.user_id) {
          const { error: notifError } = await supabase
            .from('notifications')
            .insert({
              user_id: contractor.user_id,
              type: 'payout_sent',
              channel: 'in_app',
              title: 'Payout Initiated',
              body: `A payout of $${(item.contractor_payout / 100).toFixed(2)} for order ${order.order_number} has been initiated.`,
              reference_id: order.id,
              reference_type: 'order',
              sent_at: new Date().toISOString(),
            });

          if (notifError) {
            console.error(
              `Failed to create payout notification for contractor ${contractor.id}:`,
              notifError
            );
          }
        }

        transferResults.push({
          item_id: item.id,
          transfer_id: transfer.id,
          error: null,
        });
      } catch (transferErr) {
        const message =
          transferErr instanceof Error
            ? transferErr.message
            : 'Unknown transfer error';
        console.error(
          `Failed to create transfer for item ${item.id}:`,
          transferErr
        );
        transferResults.push({
          item_id: item.id,
          transfer_id: null,
          error: message,
        });
      }
    }

    // Log platform fee transaction
    if (totalPlatformFees > 0) {
      const { error: feeTxError } = await supabase
        .from('transactions')
        .insert({
          order_id: order.id,
          type: 'platform_fee',
          amount: totalPlatformFees,
          status: 'completed',
          description: `Platform fees for order ${order.order_number}`,
        });

      if (feeTxError) {
        console.error('Failed to log platform fee transaction:', feeTxError);
      }
    }

    // Update order status to completed
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (orderUpdateError) {
      console.error('Failed to update order to completed:', orderUpdateError);
      return NextResponse.json(
        { error: 'Failed to mark order as completed' },
        { status: 500 }
      );
    }

    // Notify homeowner
    const { error: homeownerNotifError } = await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        type: 'order_completed',
        channel: 'in_app',
        title: 'Order Completed',
        body: `Your order ${order.order_number} has been completed. Thank you!`,
        reference_id: order.id,
        reference_type: 'order',
        sent_at: new Date().toISOString(),
      });

    if (homeownerNotifError) {
      console.error(
        'Failed to create completion notification:',
        homeownerNotifError
      );
    }

    return NextResponse.json({
      message: 'Order completed successfully',
      order_id: orderId,
      transfers: transferResults,
      platform_fees: totalPlatformFees,
    });
  } catch (err) {
    console.error('Unexpected error in POST /api/orders/[id]/complete:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
