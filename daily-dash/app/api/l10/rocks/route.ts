import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

function getCurrentQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()} Q${q}`;
}

// GET /api/l10/rocks
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const quarter = searchParams.get('quarter');

    const supabase = getServerSupabase();

    // Get all distinct quarters for the filter dropdown
    const { data: quarterRows } = await supabase
      .from('l10_rocks')
      .select('target_quarter')
      .order('target_quarter', { ascending: false });

    const quarters = [...new Set(quarterRows?.map((r) => r.target_quarter) || [])];
    // Ensure current quarter is in the list
    const currentQ = getCurrentQuarter();
    if (!quarters.includes(currentQ)) {
      quarters.unshift(currentQ);
    }

    // Fetch rocks for selected quarter
    let query = supabase.from('l10_rocks').select('*').order('created_at', { ascending: false });

    if (quarter) {
      query = query.eq('target_quarter', quarter);
    } else {
      query = query.eq('target_quarter', currentQ);
    }

    const { data: rocks, error } = await query;

    if (error) {
      console.error('Error fetching rocks:', error);
      return NextResponse.json({ error: 'Failed to fetch rocks' }, { status: 500 });
    }

    return NextResponse.json({ rocks, quarters });
  } catch (error) {
    console.error('Error in rocks GET:', error);
    return NextResponse.json({ error: 'Failed to fetch rocks' }, { status: 500 });
  }
}

// POST /api/l10/rocks
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, owner_names, owner_ids, department, status, target_quarter, notes } = body;

    if (!title || !owner_names?.length || !target_quarter) {
      return NextResponse.json({ error: 'Title, at least one owner, and quarter are required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('l10_rocks')
      .insert({
        title,
        owner_names,
        owner_ids: owner_ids || [],
        department: department || null,
        status: status || 'on_track',
        target_quarter,
        notes: notes || null,
        created_by: session.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating rock:', error);
      return NextResponse.json({ error: 'Failed to create rock' }, { status: 500 });
    }

    return NextResponse.json({ rock: data });
  } catch (error) {
    console.error('Error in rocks POST:', error);
    return NextResponse.json({ error: 'Failed to create rock' }, { status: 500 });
  }
}
