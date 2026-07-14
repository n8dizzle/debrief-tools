import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { broadcastChange } from '@/lib/realtime';
import { hasPEPermission } from '@/lib/pe-utils';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasPEPermission(session, 'can_view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('pe_warranty_claims')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ claims: data || [] });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasPEPermission(session, 'can_manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const supabase = getServerSupabase();

  const newClaim = {
    last_name: body.last_name || '',
    mfgr: body.mfgr || '',
    fail_date: body.fail_date || null,
    repair_date: body.repair_date || null,
    main_model_num: body.main_model_num || '',
    main_unit_sn: body.main_unit_sn || '',
    failed_part_num: body.failed_part_num || '',
    failed_part_serial: body.failed_part_serial || '',
    mfg_invoice_num: body.mfg_invoice_num || '',
    repl_part_num: body.repl_part_num || '',
    repl_part_serial: body.repl_part_serial || '',
    date_of_claim: body.date_of_claim || null,
    claim_num: body.claim_num || '',
    credit_approved: body.credit_approved || '',
    return_required: body.return_required || '',
    amt_charged: body.amt_charged || '',
    amt_refunded: body.amt_refunded || '',
    paid: body.paid || '',
    job: body.job || '',
    tech: body.tech || '',
    customer: body.customer || '',
    status: body.status || 'active',
  };

  const { data, error } = await supabase
    .from('pe_warranty_claims')
    .insert(newClaim)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await broadcastChange({ source: 'warranty-create' });
  return NextResponse.json({ claim: data }, { status: 201 });
}
