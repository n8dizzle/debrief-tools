import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  const supabase = getServerSupabase();
  const canViewPay = session.user.role === 'owner' || session.user.role === 'manager';

  try {
    let query = supabase
      .from('pr_gross_pay_items')
      .select('*')
      .eq('employee_id', id)
      .order('date', { ascending: false });

    if (start && end) {
      query = query.gte('date', start).lte('date', end);
    }

    const { data: items } = await query;

    // Mask amounts if not authorized
    const result = (items || []).map(item => ({
      ...item,
      amount: canViewPay ? item.amount : 0,
    }));

    return NextResponse.json({ items: result, can_view_pay: canViewPay });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
