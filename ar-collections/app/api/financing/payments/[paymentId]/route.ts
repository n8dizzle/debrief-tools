import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// PATCH - Update a specific expected payment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentId } = await params;
    const body = await request.json();
    const supabase = getServerSupabase();

    // Validate status if provided
    const validStatuses = ['pending', 'paid', 'missed', 'late', 'partial'];
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Build update object
    const updates: Record<string, any> = {};
    if (body.status !== undefined) updates.status = body.status;
    if (body.payment_date !== undefined) updates.payment_date = body.payment_date;
    if (body.amount_paid !== undefined) updates.amount_paid = body.amount_paid;
    if (body.notes !== undefined) updates.notes = body.notes;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const { data: payment, error } = await supabase
      .from('ar_financing_payments')
      .update(updates)
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      console.error('Error updating payment:', error);
      return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
    }

    return NextResponse.json({ success: true, payment });
  } catch (error) {
    console.error('Payment update error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
