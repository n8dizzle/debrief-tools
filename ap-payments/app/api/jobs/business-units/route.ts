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

  const { data, error } = await supabase
    .from('ap_install_jobs')
    .select('business_unit_name')
    .not('business_unit_name', 'is', null)
    .order('business_unit_name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get distinct sorted names
  const names = [...new Set((data || []).map(r => r.business_unit_name as string))];

  return NextResponse.json(names);
}
