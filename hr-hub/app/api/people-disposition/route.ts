import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type SessionUser = { id?: string; role?: string; permissions?: Record<string, Record<string, boolean>> | null };

// Viewing the fix list needs can_access. Changing what the company considers "not a
// person we manage" is a judgment that sticks, so it needs the manage permission.
function canDisposition(user: SessionUser | undefined): boolean {
  return !!user && (user.role === 'owner' || !!user.permissions?.hr_hub?.can_manage_templates);
}

const SYSTEMS = new Set(['st_employee', 'st_technician']);
const DISPOSITIONS = new Set(['not_a_person', 'vendor', 'system_account', 'unmanaged']);

// POST /api/people-disposition — classify a ServiceTitan record as something we do not
// manage, or clear that classification.
//
//   { system, external_id, external_name?, disposition, note? }  -> set
//   { system, external_id, disposition: null }                   -> clear
//
// This records WHAT A RECORD IS, not that work was completed. That distinction is why
// it is safe to persist: "*After Hours is not a person" stays true, whereas "I fixed
// this" goes stale the moment ServiceTitan changes. The fix list therefore has
// dispositions but deliberately has no done-checkbox.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canDisposition(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const system = String(body?.system || '');
  const externalId = body?.external_id == null ? '' : String(body.external_id);
  const disposition = body?.disposition ?? null;

  if (!SYSTEMS.has(system)) {
    return NextResponse.json({ error: `system must be one of: ${[...SYSTEMS].join(', ')}` }, { status: 400 });
  }
  if (!externalId) return NextResponse.json({ error: 'external_id required' }, { status: 400 });

  const supabase = getServerSupabase();

  // Clearing a disposition puts the record back in the fix list.
  if (disposition === null) {
    const { error } = await supabase
      .from('hr_people_dispositions')
      .delete()
      .eq('system', system)
      .eq('external_id', externalId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, cleared: true });
  }

  if (!DISPOSITIONS.has(String(disposition))) {
    return NextResponse.json(
      { error: `disposition must be null or one of: ${[...DISPOSITIONS].join(', ')}` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('hr_people_dispositions')
    .upsert(
      {
        system,
        external_id: externalId,
        external_name: body?.external_name ? String(body.external_name) : null,
        disposition: String(disposition),
        note: body?.note ? String(body.note) : null,
        created_by: user.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'system,external_id' }
    )
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, row: data });
}
