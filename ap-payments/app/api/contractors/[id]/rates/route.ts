import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('ap_contractor_rates')
    .select('*')
    .eq('contractor_id', id)
    .order('trade')
    .order('job_type_name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role || 'employee';
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { trade, job_type_name, rate_amount, rate_type } = body;

  if (!trade || !job_type_name || rate_amount == null) {
    return NextResponse.json({ error: 'trade, job_type_name, and rate_amount are required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('ap_contractor_rates')
    .upsert(
      {
        contractor_id: id,
        trade,
        job_type_name,
        rate_amount,
        rate_type: rate_type || 'flat',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'contractor_id,trade,job_type_name' }
    )
    .select()
    .single();

  if (error) {
    console.error('Error upserting rate:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role || 'employee';
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { rate_id, rate_amount } = body;

  if (!rate_id || rate_amount == null) {
    return NextResponse.json({ error: 'rate_id and rate_amount are required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('ap_contractor_rates')
    .update({ rate_amount, updated_at: new Date().toISOString() })
    .eq('id', rate_id)
    .select()
    .single();

  if (error) {
    console.error('Error updating rate:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
