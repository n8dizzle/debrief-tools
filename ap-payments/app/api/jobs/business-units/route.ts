import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  const { data, error } = await supabase.rpc('ap_distinct_business_units');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const names = (data || []).map((r: { business_unit_name: string }) => r.business_unit_name);

  return NextResponse.json(names);
}
