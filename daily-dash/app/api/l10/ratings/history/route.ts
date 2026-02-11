import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// GET /api/l10/ratings/history - Full history of all meetings with ratings + feedback
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();

    // Fetch all ratings
    const { data: allRatings, error: ratingsError } = await supabase
      .from('l10_meeting_ratings')
      .select('meeting_date, user_id, user_name, rating')
      .order('meeting_date', { ascending: false });

    if (ratingsError) {
      console.error('Error fetching ratings history:', ratingsError);
      return NextResponse.json({ error: 'Failed to fetch ratings history' }, { status: 500 });
    }

    // Fetch all feedback notes
    const { data: allFeedback, error: feedbackError } = await supabase
      .from('l10_meeting_feedback')
      .select('meeting_date, feedback_note');

    if (feedbackError) {
      console.error('Error fetching feedback:', feedbackError);
    }

    // Build feedback lookup
    const feedbackMap = new Map<string, string>();
    (allFeedback || []).forEach((f) => {
      if (f.feedback_note) {
        feedbackMap.set(f.meeting_date, f.feedback_note);
      }
    });

    // Group ratings by meeting date
    const meetingMap = new Map<string, { user_id: string; user_name: string; rating: number }[]>();
    const participantMap = new Map<string, string>(); // user_id -> user_name

    (allRatings || []).forEach((r) => {
      const existing = meetingMap.get(r.meeting_date);
      if (existing) {
        existing.push({ user_id: r.user_id, user_name: r.user_name, rating: r.rating });
      } else {
        meetingMap.set(r.meeting_date, [{ user_id: r.user_id, user_name: r.user_name, rating: r.rating }]);
      }
      // Track most recent user_name for each user_id
      if (!participantMap.has(r.user_id)) {
        participantMap.set(r.user_id, r.user_name);
      }
    });

    // Build meetings array
    const meetings = Array.from(meetingMap.entries())
      .map(([meeting_date, ratings]) => {
        const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
        return {
          meeting_date,
          average: Math.round(avg * 10) / 10,
          feedback_note: feedbackMap.get(meeting_date) || null,
          ratings,
        };
      })
      .sort((a, b) => b.meeting_date.localeCompare(a.meeting_date));

    // Build participants list (sorted by name)
    const participants = Array.from(participantMap.entries())
      .map(([user_id, user_name]) => ({ user_id, user_name }))
      .sort((a, b) => a.user_name.localeCompare(b.user_name));

    return NextResponse.json({ meetings, participants });
  } catch (error) {
    console.error('Error in ratings history GET:', error);
    return NextResponse.json({ error: 'Failed to fetch ratings history' }, { status: 500 });
  }
}
