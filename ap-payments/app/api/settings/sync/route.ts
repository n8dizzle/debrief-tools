import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// GET - Fetch BU-to-trade mapping
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('ap_sync_settings')
    .select('value')
    .eq('key', 'bu_trade_mapping')
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    bu_trade_mapping: data?.value || {},
  });
}

// PATCH - Update BU-to-trade mapping
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role || 'employee';
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { bu_trade_mapping } = body;

  if (bu_trade_mapping === undefined) {
    return NextResponse.json({ error: 'bu_trade_mapping is required' }, { status: 400 });
  }

  if (typeof bu_trade_mapping !== 'object' || bu_trade_mapping === null) {
    return NextResponse.json({ error: 'bu_trade_mapping must be an object' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('ap_sync_settings')
    .upsert({ key: 'bu_trade_mapping', value: bu_trade_mapping, updated_at: now }, { onConflict: 'key' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
