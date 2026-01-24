import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { lookupSlackUserByEmail, isSlackEnabled } from '@/lib/slack';

/**
 * POST /api/slack/lookup
 * Look up a Slack user by email and optionally save to team_members
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is owner or manager
  const { role } = session.user as { role?: string };
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  if (!isSlackEnabled()) {
    return NextResponse.json({ error: 'Slack integration is not enabled' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { email, teamMemberId, save } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Look up user in Slack
    const slackUser = await lookupSlackUserByEmail(email);

    if (!slackUser) {
      return NextResponse.json({
        found: false,
        message: 'No Slack user found with this email',
      });
    }

    // Optionally save the Slack user ID to team_members
    if (save && teamMemberId) {
      const supabase = getServerSupabase();

      const { error: updateError } = await supabase
        .from('team_members')
        .update({
          slack_user_id: slackUser.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', teamMemberId);

      if (updateError) {
        console.error('Failed to save Slack user ID:', updateError);
        return NextResponse.json({
          found: true,
          slackUser,
          saved: false,
          error: 'Failed to save Slack user ID to database',
        });
      }

      return NextResponse.json({
        found: true,
        slackUser,
        saved: true,
      });
    }

    return NextResponse.json({
      found: true,
      slackUser,
    });
  } catch (error) {
    console.error('Slack lookup error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lookup failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/slack/lookup
 * Check Slack integration status
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    enabled: isSlackEnabled(),
    configured: !!process.env.SLACK_BOT_TOKEN,
  });
}
