import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getTodayDateString } from '@/lib/ar-utils';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planId } = params;
    const body = await request.json();
    const { year, month, paid } = body;

    if (!year || !month) {
      return NextResponse.json({ error: 'Year and month required' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // Check if month record exists
    const { data: existingMonth } = await supabase
      .from('ar_payment_plan_months')
      .select('id')
      .eq('plan_id', planId)
      .eq('year', year)
      .eq('month', month)
      .single();

    const today = getTodayDateString();

    if (existingMonth) {
      // Update existing month
      const { data, error } = await supabase
        .from('ar_payment_plan_months')
        .update({
          status: paid ? 'paid' : 'pending',
          paid_date: paid ? today : null,
        })
        .eq('id', existingMonth.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating month:', error);
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
      }

      return NextResponse.json({ month: data });
    } else {
      // Get plan to get payment amount
      const { data: plan } = await supabase
        .from('ar_payment_plans')
        .select('monthly_payment_amount')
        .eq('id', planId)
        .single();

      // Create new month record
      const { data, error } = await supabase
        .from('ar_payment_plan_months')
        .insert({
          plan_id: planId,
          year,
          month,
          payment_due: plan?.monthly_payment_amount || 0,
          status: paid ? 'paid' : 'pending',
          paid_date: paid ? today : null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating month:', error);
        return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
      }

      return NextResponse.json({ month: data });
    }
  } catch (error) {
    console.error('Payment plan months API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
