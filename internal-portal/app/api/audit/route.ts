import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

/**
 * GET /api/audit
 * List audit log entries (owners only)
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only owners can view audit log
  if (session.user.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden: Owner access required' }, { status: 403 });
  }

  const supabase = getServerSupabase();

  try {
    const { data: entries, error } = await supabase
      .from('portal_audit_log')
      .select(`
        id,
        actor_id,
        action,
        target_type,
        target_id,
        old_value,
        new_value,
        ip_address,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching audit log:', error);
      return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 });
    }

    // Fetch actor and target user info
    const actorIds = Array.from(new Set(entries.filter((e) => e.actor_id).map((e) => e.actor_id)));
    const targetIds = Array.from(new Set(entries.filter((e) => e.target_type === 'user' && e.target_id).map((e) => e.target_id)));
    const allUserIds = Array.from(new Set([...actorIds, ...targetIds]));

    let usersMap: Record<string, { id: string; name: string | null; email: string }> = {};

    if (allUserIds.length > 0) {
      const { data: users } = await supabase
        .from('portal_users')
        .select('id, name, email')
        .in('id', allUserIds);

      if (users) {
        usersMap = users.reduce((acc, user) => {
          acc[user.id] = user;
          return acc;
        }, {} as typeof usersMap);
      }
    }

    // Enrich entries with user info
    const enrichedEntries = entries.map((entry) => ({
      ...entry,
      actor: entry.actor_id ? usersMap[entry.actor_id] : null,
      target_user: entry.target_type === 'user' && entry.target_id ? usersMap[entry.target_id] : null,
    }));

    return NextResponse.json({ entries: enrichedEntries });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 });
  }
}
