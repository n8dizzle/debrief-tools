import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get the Tuesday of a given week (L10 meeting day)
function getTuesday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // For Sun (0): go back 5 days to last Tue
  // For Mon (1): go forward 1 day to Tue
  // For Tue (2): stay
  // For Wed-Sat (3-6): go back to this week's Tue
  const diff = day === 0 ? -5 : 2 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Weeks since epoch (Jan 6, 1970 - first Tuesday)
function weeksSinceEpoch(date: Date): number {
  const tuesday = getTuesday(date);
  const epoch = new Date(1970, 0, 6); // First Tuesday of 1970
  const diff = tuesday.getTime() - epoch.getTime();
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
}

interface RotationMember {
  id: string;
  member_name: string;
  display_order: number;
}

function getScheduledMember(weekDate: Date, members: RotationMember[]): RotationMember | null {
  if (!members.length) return null;
  const weekIndex = weeksSinceEpoch(weekDate) % members.length;
  return members[weekIndex];
}

// GET /api/l10/stories - Get current week, upcoming, and past stories
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();

    // Get active rotation members
    const { data: members } = await supabase
      .from('l10_story_rotation')
      .select('id, member_name, display_order')
      .eq('is_active', true)
      .order('display_order');

    const activeMembers = (members || []) as RotationMember[];

    // Get all story history (past + future scheduled)
    const { data: history } = await supabase
      .from('l10_story_history')
      .select('*')
      .order('week_date', { ascending: false });

    const historyMap = new Map((history || []).map((h) => [h.week_date, h]));

    const now = new Date();
    const currentTuesday = getTuesday(now);

    // Build current week
    const currentWeekDate = formatLocalDate(currentTuesday);
    const currentHistory = historyMap.get(currentWeekDate);
    let currentMember: RotationMember | null = null;

    if (currentHistory?.is_override) {
      // Override: use the stored member
      currentMember = activeMembers.find((m) => m.id === currentHistory.rotation_member_id) || null;
    } else {
      currentMember = getScheduledMember(currentTuesday, activeMembers);
    }

    const currentWeek = {
      week_date: currentWeekDate,
      member_name: currentHistory?.member_name || currentMember?.member_name || 'No one assigned',
      rotation_member_id: currentHistory?.rotation_member_id || currentMember?.id || null,
      is_told: currentHistory?.is_told || false,
      told_at: currentHistory?.told_at || null,
      notes: currentHistory?.notes || null,
      is_override: currentHistory?.is_override || false,
      history_id: currentHistory?.id || null,
    };

    // Build upcoming weeks (next 6)
    const upcoming = [];
    for (let i = 1; i <= 6; i++) {
      const weekDate = new Date(currentTuesday);
      weekDate.setDate(weekDate.getDate() + i * 7);
      const dateStr = formatLocalDate(weekDate);
      const hist = historyMap.get(dateStr);
      let member: RotationMember | null = null;

      if (hist?.is_override) {
        member = activeMembers.find((m) => m.id === hist.rotation_member_id) || null;
      } else {
        member = getScheduledMember(weekDate, activeMembers);
      }

      upcoming.push({
        week_date: dateStr,
        member_name: hist?.member_name || member?.member_name || 'TBD',
        rotation_member_id: hist?.rotation_member_id || member?.id || null,
        is_told: hist?.is_told || false,
        told_at: hist?.told_at || null,
        notes: hist?.notes || null,
        is_override: hist?.is_override || false,
        history_id: hist?.id || null,
      });
    }

    // Past stories (from history)
    const past = (history || []).filter((h) => h.week_date < currentWeekDate);

    return NextResponse.json({ current_week: currentWeek, upcoming, past });
  } catch (error) {
    console.error('Error in stories GET:', error);
    return NextResponse.json({ error: 'Failed to fetch stories' }, { status: 500 });
  }
}

// POST /api/l10/stories - Mark story as told or override assignment
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { week_date, action } = body;

    if (!week_date) {
      return NextResponse.json({ error: 'week_date is required' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    if (action === 'mark_told') {
      // Get current member for this week
      const { data: members } = await supabase
        .from('l10_story_rotation')
        .select('id, member_name, display_order')
        .eq('is_active', true)
        .order('display_order');

      const activeMembers = (members || []) as RotationMember[];
      const weekDate = new Date(week_date + 'T12:00:00');
      const member = getScheduledMember(weekDate, activeMembers);

      // Check if history exists
      const { data: existing } = await supabase
        .from('l10_story_history')
        .select('id, is_told')
        .eq('week_date', week_date)
        .single();

      if (existing) {
        // Toggle told status
        const { error } = await supabase
          .from('l10_story_history')
          .update({
            is_told: !existing.is_told,
            told_at: !existing.is_told ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create history entry
        const { error } = await supabase
          .from('l10_story_history')
          .insert({
            week_date,
            rotation_member_id: member?.id || null,
            member_name: member?.member_name || 'Unknown',
            is_told: true,
            told_at: new Date().toISOString(),
            created_by: session.user.id,
          });

        if (error) throw error;
      }
    } else if (action === 'edit') {
      // Edit a meeting: change person and/or date
      const { rotation_member_id, member_name, new_date } = body;

      const updates: Record<string, unknown> = {
        is_override: true,
        updated_at: new Date().toISOString(),
      };
      if (rotation_member_id && member_name) {
        updates.rotation_member_id = rotation_member_id;
        updates.member_name = member_name;
      }
      if (new_date && new_date !== week_date) {
        updates.week_date = new_date;
      }

      const { data: existing } = await supabase
        .from('l10_story_history')
        .select('id')
        .eq('week_date', week_date)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('l10_story_history')
          .update(updates)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('l10_story_history')
          .insert({
            week_date: new_date || week_date,
            rotation_member_id: rotation_member_id || null,
            member_name: member_name || 'TBD',
            is_override: true,
            created_by: session.user.id,
          });

        if (error) throw error;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in stories POST:', error);
    return NextResponse.json({ error: 'Failed to update story' }, { status: 500 });
  }
}
