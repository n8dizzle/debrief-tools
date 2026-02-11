import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// GET /api/l10/issues
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const { data: issues, error } = await supabase
      .from('l10_issues')
      .select('*')
      .order('is_resolved', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching issues:', error);
      return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 500 });
    }

    return NextResponse.json({ issues });
  } catch (error) {
    console.error('Error in issues GET:', error);
    return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 500 });
  }
}

// POST /api/l10/issues
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, priority, owner_name, owner_id, notes } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('l10_issues')
      .insert({
        title,
        priority: priority || null,
        owner_name: owner_name || null,
        owner_id: owner_id || null,
        notes: notes || null,
        created_by: session.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating issue:', error);
      return NextResponse.json({ error: 'Failed to create issue' }, { status: 500 });
    }

    return NextResponse.json({ issue: data });
  } catch (error) {
    console.error('Error in issues POST:', error);
    return NextResponse.json({ error: 'Failed to create issue' }, { status: 500 });
  }
}
