import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// GET /api/l10/todos
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';

    const supabase = getServerSupabase();
    let query = supabase
      .from('l10_todos')
      .select('*')
      .order('is_done', { ascending: true })
      .order('created_at', { ascending: false });

    if (filter === 'open') {
      query = query.eq('is_done', false);
    } else if (filter === 'done') {
      query = query.eq('is_done', true);
    }

    const { data: todos, error } = await query;

    if (error) {
      console.error('Error fetching todos:', error);
      return NextResponse.json({ error: 'Failed to fetch todos' }, { status: 500 });
    }

    return NextResponse.json({ todos });
  } catch (error) {
    console.error('Error in todos GET:', error);
    return NextResponse.json({ error: 'Failed to fetch todos' }, { status: 500 });
  }
}

// POST /api/l10/todos
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, owner_name, owner_id, due_date, notes } = body;

    if (!title || !owner_name) {
      return NextResponse.json({ error: 'Title and owner are required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('l10_todos')
      .insert({
        title,
        owner_name,
        owner_id: owner_id || null,
        due_date: due_date || null,
        notes: notes || null,
        created_by: session.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating todo:', error);
      return NextResponse.json({ error: 'Failed to create todo' }, { status: 500 });
    }

    return NextResponse.json({ todo: data });
  } catch (error) {
    console.error('Error in todos POST:', error);
    return NextResponse.json({ error: 'Failed to create todo' }, { status: 500 });
  }
}
