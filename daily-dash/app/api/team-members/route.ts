import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

/**
 * GET /api/team-members
 * List all team members
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();

  try {
    const { data: teamMembers, error } = await supabase
      .from('team_members')
      .select('*')
      .order('name');

    if (error) {
      throw new Error(`Failed to fetch team members: ${error.message}`);
    }

    // Get count of reviews mentioning each team member
    const { data: reviews } = await supabase
      .from('google_reviews')
      .select('team_members_mentioned')
      .not('team_members_mentioned', 'is', null);

    // Count mentions per person
    const mentionCounts: Record<string, number> = {};
    for (const review of reviews || []) {
      const mentions = review.team_members_mentioned as string[] | null;
      if (mentions) {
        for (const name of mentions) {
          mentionCounts[name] = (mentionCounts[name] || 0) + 1;
        }
      }
    }

    // Add mention counts to team members
    const membersWithCounts = (teamMembers || []).map(member => ({
      ...member,
      mention_count: mentionCounts[member.name] || 0,
    }));

    return NextResponse.json({
      teamMembers: membersWithCounts,
      total: membersWithCounts.length,
      active: membersWithCounts.filter(m => m.is_active).length,
    });
  } catch (error) {
    console.error('Team members fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch team members' },
      { status: 500 }
    );
  }
}
