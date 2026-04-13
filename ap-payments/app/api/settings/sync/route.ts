import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasAPPermission } from '@/lib/ap-utils';

// GET - Fetch all sync settings
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('ap_sync_settings')
    .select('key, value')
    .in('key', ['bu_trade_mapping', 'sync_business_units', 'default_hourly_rates']);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const settingsMap = new Map((data || []).map(r => [r.key, r.value]));

  return NextResponse.json({
    bu_trade_mapping: settingsMap.get('bu_trade_mapping') || {},
    sync_business_units: settingsMap.get('sync_business_units') || [],
    default_hourly_rates: settingsMap.get('default_hourly_rates') || {},
  });
}

// PATCH - Update sync settings
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasAPPermission(session, 'can_sync_data')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { bu_trade_mapping, sync_business_units, default_hourly_rates } = body;

  const supabase = getServerSupabase();
  const now = new Date().toISOString();

  const upserts: { key: string; value: unknown; updated_at: string }[] = [];

  if (bu_trade_mapping !== undefined) {
    if (typeof bu_trade_mapping !== 'object' || bu_trade_mapping === null) {
      return NextResponse.json({ error: 'bu_trade_mapping must be an object' }, { status: 400 });
    }
    upserts.push({ key: 'bu_trade_mapping', value: bu_trade_mapping, updated_at: now });
  }

  if (sync_business_units !== undefined) {
    if (!Array.isArray(sync_business_units)) {
      return NextResponse.json({ error: 'sync_business_units must be an array' }, { status: 400 });
    }
    upserts.push({ key: 'sync_business_units', value: sync_business_units, updated_at: now });
  }

  if (default_hourly_rates !== undefined) {
    if (typeof default_hourly_rates !== 'object' || default_hourly_rates === null) {
      return NextResponse.json({ error: 'default_hourly_rates must be an object' }, { status: 400 });
    }
    upserts.push({ key: 'default_hourly_rates', value: default_hourly_rates, updated_at: now });
  }

  if (upserts.length === 0) {
    return NextResponse.json({ error: 'No valid settings provided' }, { status: 400 });
  }

  const { error } = await supabase
    .from('ap_sync_settings')
    .upsert(upserts, { onConflict: 'key' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
