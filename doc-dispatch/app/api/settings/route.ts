import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('dd_settings')
    .select('key, value');

  if (error) {
    console.error('Settings fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }

  const settings: Record<string, any> = {};
  for (const row of data || []) {
    settings[row.key] = row.value;
  }

  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check manager+ role
  const role = (session.user as any).role;
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { key, value } = body;

  if (!key || value === undefined) {
    return NextResponse.json({ error: 'key and value required' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { error } = await supabase
    .from('dd_settings')
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
      updated_by: session.user.id,
    }, { onConflict: 'key' });

  if (error) {
    console.error('Settings update error:', error);
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
