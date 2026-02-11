import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// GET - Fetch sync settings (which BUs are enabled)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('ap_sync_settings')
    .select('key, value')
    .eq('key', 'sync_business_units')
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    enabled_business_units: data?.value || ['HVAC - Install', 'Plumbing - Install'],
  });
}

// PATCH - Update sync settings
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
  const { enabled_business_units } = body;

  if (!Array.isArray(enabled_business_units)) {
    return NextResponse.json({ error: 'enabled_business_units must be an array' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  const { error } = await supabase
    .from('ap_sync_settings')
    .upsert({
      key: 'sync_business_units',
      value: enabled_business_units,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, enabled_business_units });
}
