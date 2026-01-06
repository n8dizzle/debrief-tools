import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// PUT /api/huddle/notes - Update a note for a KPI
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { kpi_id, note_date, note_text } = body;

    if (!kpi_id || !note_date) {
      return NextResponse.json(
        { error: 'Missing required fields: kpi_id and note_date' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabase();

    // Upsert the note
    const { data, error } = await supabase
      .from('huddle_notes')
      .upsert(
        {
          kpi_id,
          note_date,
          note_text: note_text || '',
          updated_by: session.user.id,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'kpi_id,note_date',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Error saving note:', error);
      return NextResponse.json({ error: 'Failed to save note' }, { status: 500 });
    }

    return NextResponse.json({ success: true, note: data });
  } catch (error) {
    console.error('Error in notes PUT:', error);
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 });
  }
}

// GET /api/huddle/notes - Get notes for a date
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json({ error: 'Date parameter required' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    const { data: notes, error } = await supabase
      .from('huddle_notes')
      .select('*, portal_users(name, email)')
      .eq('note_date', date);

    if (error) {
      console.error('Error fetching notes:', error);
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
    }

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Error in notes GET:', error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}
