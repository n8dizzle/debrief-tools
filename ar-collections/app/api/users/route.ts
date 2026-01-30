import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

interface ARCollectionsPermissions {
  can_view_invoices?: boolean;
  can_update_invoices?: boolean;
  can_log_communications?: boolean;
  can_view_reports?: boolean;
  can_manage_settings?: boolean;
}

interface UserPermissions {
  ar_collections?: ARCollectionsPermissions;
}

interface PortalUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department_id: string | null;
  is_active: boolean;
  permissions: UserPermissions | null;
}

function hasARCollectionsAccess(user: PortalUser): boolean {
  // Check if user has any AR Collections permission set to true
  const arPerms = user.permissions?.ar_collections;
  if (!arPerms) {
    return false;
  }

  return (
    arPerms.can_view_invoices === true ||
    arPerms.can_update_invoices === true ||
    arPerms.can_log_communications === true ||
    arPerms.can_view_reports === true ||
    arPerms.can_manage_settings === true
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();

    // Fetch all active users with their permissions
    const { data: users, error } = await supabase
      .from('portal_users')
      .select('id, name, email, role, department_id, is_active, permissions')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Filter to only users with AR Collections access
    const arUsers = (users as PortalUser[] || [])
      .filter(hasARCollectionsAccess)
      .map(({ permissions, ...user }) => user); // Remove permissions from response

    return NextResponse.json({ users: arUsers });
  } catch (error) {
    console.error('Users API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
