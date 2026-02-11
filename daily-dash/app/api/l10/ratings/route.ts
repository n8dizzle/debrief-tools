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
  const diff = day === 0 ? -5 : 2 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// GET /api/l10/ratings
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    // Default to this week's Tuesday
    const targetDate = dateParam || formatLocalDate(getTuesday(new Date()));

    const supabase = getServerSupabase();

    // Get ratings for the selected date
    const { data: ratings, error } = await supabase
      .from('l10_meeting_ratings')
      .select('*')
      .eq('meeting_date', targetDate)
      .order('created_at');

    if (error) {
      console.error('Error fetching ratings:', error);
      return NextResponse.json({ error: 'Failed to fetch ratings' }, { status: 500 });
    }

    // Get feedback note for this date
    const { data: feedback } = await supabase
      .from('l10_meeting_feedback')
      .select('feedback_note')
      .eq('meeting_date', targetDate)
      .maybeSingle();

    // Calculate average
    const avg = ratings && ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : null;

    // Get weekly trend (last 12 weeks)
    const { data: trendData, error: trendError } = await supabase
      .from('l10_meeting_ratings')
      .select('meeting_date, rating')
      .order('meeting_date', { ascending: false });

    if (trendError) {
      console.error('Error fetching trend:', trendError);
    }

    // Aggregate by week
    const weekMap = new Map<string, { sum: number; count: number }>();
    (trendData || []).forEach((r) => {
      const existing = weekMap.get(r.meeting_date);
      if (existing) {
        existing.sum += r.rating;
        existing.count += 1;
      } else {
        weekMap.set(r.meeting_date, { sum: r.rating, count: 1 });
      }
    });

    const trend = Array.from(weekMap.entries())
      .map(([week_date, { sum, count }]) => ({
        week_date,
        average: Math.round((sum / count) * 10) / 10,
        count,
      }))
      .sort((a, b) => a.week_date.localeCompare(b.week_date))
      .slice(-12);

    return NextResponse.json({
      current: {
        date: targetDate,
        ratings: ratings || [],
        average: avg ? Math.round(avg * 10) / 10 : null,
        feedback_note: feedback?.feedback_note || null,
      },
      trend,
    });
  } catch (error) {
    console.error('Error in ratings GET:', error);
    return NextResponse.json({ error: 'Failed to fetch ratings' }, { status: 500 });
  }
}

// POST /api/l10/ratings - Bulk submit ratings for multiple users + optional feedback
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { meeting_date, ratings, feedback_note } = body;

    if (!meeting_date) {
      return NextResponse.json({ error: 'meeting_date is required' }, { status: 400 });
    }

    if (!ratings || !Array.isArray(ratings) || ratings.length === 0) {
      return NextResponse.json({ error: 'ratings array is required' }, { status: 400 });
    }

    // Validate each rating
    for (const r of ratings) {
      if (!r.user_id || !r.rating || r.rating < 1 || r.rating > 10) {
        return NextResponse.json(
          { error: `Invalid rating for user ${r.user_name || r.user_id}: must be 1-10` },
          { status: 400 }
        );
      }
    }

    const supabase = getServerSupabase();

    // Upsert all ratings
    const ratingsToUpsert = ratings.map((r: { user_id: string; user_name: string; rating: number }) => ({
      meeting_date,
      user_id: r.user_id,
      user_name: r.user_name,
      rating: r.rating,
      updated_at: new Date().toISOString(),
    }));

    const { error: ratingsError } = await supabase
      .from('l10_meeting_ratings')
      .upsert(ratingsToUpsert, {
        onConflict: 'meeting_date,user_id',
      });

    if (ratingsError) {
      console.error('Error saving ratings:', ratingsError);
      return NextResponse.json({ error: 'Failed to save ratings' }, { status: 500 });
    }

    // Upsert feedback note if provided (or clear it if empty string)
    if (feedback_note !== undefined) {
      const { error: feedbackError } = await supabase
        .from('l10_meeting_feedback')
        .upsert(
          {
            meeting_date,
            feedback_note: feedback_note || null,
            updated_by: session.user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'meeting_date' }
        );

      if (feedbackError) {
        console.error('Error saving feedback:', feedbackError);
        return NextResponse.json({ error: 'Failed to save feedback note' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, count: ratings.length });
  } catch (error) {
    console.error('Error in ratings POST:', error);
    return NextResponse.json({ error: 'Failed to save ratings' }, { status: 500 });
  }
}
