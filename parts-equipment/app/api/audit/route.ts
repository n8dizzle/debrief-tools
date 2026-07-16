import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { hasPEPermission } from '@/lib/pe-utils';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasPEPermission(session, 'can_view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Free-text search across job #, customer name, who made the change, and the
  // action/detail/type text. Searches the FULL history server-side (not just the
  // recent page) so looking up an old job still finds it.
  const q = (request.nextUrl.searchParams.get('q') || '').trim();

  const supabase = getServerSupabase();
  let query = supabase
    .from('pe_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (q) {
    // Sanitize: PostgREST `.or()` uses commas/parentheses as syntax, so strip
    // them (and the `*` wildcard) from user input before wrapping in %...%.
    const safe = q.replace(/[,()*]/g, ' ').trim();
    if (safe) {
      const like = `%${safe}%`;
      query = query.or(
        `job_id.ilike.${like},customer.ilike.${like},changed_by.ilike.${like},action.ilike.${like},detail.ilike.${like},type.ilike.${like}`
      );
    }
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entries: data || [] });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('pe_audit_log')
    .insert({
      type: body.type || 'edit',
      job_id: body.job_id || '',
      customer: body.customer || '',
      action: body.action || '',
      detail: body.detail || '',
      changed_by: body.changed_by || session.user.email || session.user.name || 'Unknown',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry: data }, { status: 201 });
}
