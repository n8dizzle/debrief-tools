import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const supabase = getServerSupabase();

    let query = supabase
      .from('ar_payment_plans')
      .select(`
        *,
        customer:ar_customers(*),
        owner:portal_users(id, name, email),
        months:ar_payment_plan_months(*)
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: plans, error } = await query;

    if (error) {
      console.error('Error fetching payment plans:', error);
      return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
    }

    return NextResponse.json({ plans: plans || [] });
  } catch (error) {
    console.error('Payment plans API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !['manager', 'owner'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      customer_id,
      invoice_id,
      total_balance,
      monthly_payment_amount,
      payment_due_day,
      start_date,
      notes,
    } = body;

    if (!customer_id || !total_balance || !monthly_payment_amount || !payment_due_day || !start_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // Calculate estimated end date
    const months = Math.ceil(total_balance / monthly_payment_amount);
    const endDate = new Date(start_date);
    endDate.setMonth(endDate.getMonth() + months);

    // Create payment plan
    const { data: plan, error: planError } = await supabase
      .from('ar_payment_plans')
      .insert({
        customer_id,
        invoice_id,
        owner_id: session.user.id,
        total_balance,
        monthly_payment_amount,
        payment_due_day,
        start_date,
        estimated_end_date: endDate.toISOString().split('T')[0],
        notes,
      })
      .select()
      .single();

    if (planError) {
      console.error('Error creating payment plan:', planError);
      return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 });
    }

    // Create monthly payment records
    const monthRecords = [];
    const startDateObj = new Date(start_date);
    for (let i = 0; i < months; i++) {
      const paymentDate = new Date(startDateObj);
      paymentDate.setMonth(paymentDate.getMonth() + i);
      monthRecords.push({
        plan_id: plan.id,
        year: paymentDate.getFullYear(),
        month: paymentDate.getMonth() + 1,
        payment_due: monthly_payment_amount,
        status: 'pending',
      });
    }

    if (monthRecords.length > 0) {
      await supabase.from('ar_payment_plan_months').insert(monthRecords);
    }

    return NextResponse.json({ plan });
  } catch (error) {
    console.error('Create payment plan API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
