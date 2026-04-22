import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// GET /api/business-unit-groups
// Reads the shared BU groups table maintained by Internal Portal.
// Returns only active groups.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();

    const [groupsRes, membersRes] = await Promise.all([
      supabase
        .from('shared_business_unit_groups')
        .select('id, key, label, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('label', { ascending: true }),
      supabase
        .from('shared_business_unit_group_members')
        .select('business_unit_name, group_id'),
    ]);

    if (groupsRes.error) throw groupsRes.error;
    if (membersRes.error) throw membersRes.error;

    const groups = groupsRes.data || [];
    const members = membersRes.data || [];

    const byGroup: Record<string, { business_unit_name: string }[]> = {};
    for (const m of members as Array<{ business_unit_name: string; group_id: string }>) {
      (byGroup[m.group_id] ||= []).push({
        business_unit_name: m.business_unit_name,
      });
    }

    return NextResponse.json({
      groups: groups.map((g: { id: string; key: string; label: string; sort_order: number; is_active: boolean }) => ({
        ...g,
        members: byGroup[g.id] || [],
      })),
    });
  } catch (error) {
    console.error('Error fetching business unit groups:', error);
    return NextResponse.json({ error: 'Failed to fetch business unit groups' }, { status: 500 });
  }
}
