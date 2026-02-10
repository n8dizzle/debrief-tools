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

  // Get contractor
  const { data: contractor, error } = await supabase
    .from('ap_contractors')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  // Get rates
  const { data: rates } = await supabase
    .from('ap_contractor_rates')
    .select('*')
    .eq('contractor_id', id)
    .order('trade')
    .order('job_type_name');

  // Get job stats
  const { data: jobs } = await supabase
    .from('ap_install_jobs')
    .select('payment_status, payment_amount')
    .eq('contractor_id', id);

  const allJobs = jobs || [];
  const totalJobs = allJobs.length;
  const totalPaid = allJobs
    .filter(j => j.payment_status === 'paid')
    .reduce((sum, j) => sum + (j.payment_amount || 0), 0);
  const totalOutstanding = allJobs
    .filter(j => j.payment_status !== 'paid' && j.payment_status !== 'none')
    .reduce((sum, j) => sum + (j.payment_amount || 0), 0);

  return NextResponse.json({
    ...contractor,
    rates: rates || [],
    total_jobs: totalJobs,
    total_paid: totalPaid,
    total_outstanding: totalOutstanding,
  });
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

  const { id } = await params;
  const body = await request.json();
  const { name, contact_name, phone, email, payment_method, payment_notes, is_active } = body;

  const supabase = getServerSupabase();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined) updateData.name = name;
  if (contact_name !== undefined) updateData.contact_name = contact_name;
  if (phone !== undefined) updateData.phone = phone;
  if (email !== undefined) updateData.email = email;
  if (payment_method !== undefined) updateData.payment_method = payment_method;
  if (payment_notes !== undefined) updateData.payment_notes = payment_notes;
  if (is_active !== undefined) updateData.is_active = is_active;

  const { data, error } = await supabase
    .from('ap_contractors')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating contractor:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
