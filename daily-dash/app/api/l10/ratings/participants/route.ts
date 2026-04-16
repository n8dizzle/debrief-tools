import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// GET /api/l10/ratings/participants
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const { data: participants, error } = await supabase
      .from('l10_rating_participants')
      .select('*')
      .order('display_order');

    if (error) {
      console.error('Error fetching rating participants:', error);
      return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 });
    }

    return NextResponse.json({ participants });
  } catch (error) {
    console.error('Error in rating participants GET:', error);
    return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 });
  }
}

// POST /api/l10/ratings/participants - Add a participant
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { user_id, user_name } = body;

    if (!user_id || !user_name) {
      return NextResponse.json({ error: 'user_id and user_name are required' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // Get max display_order
    const { data: maxOrder } = await supabase
      .from('l10_rating_participants')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrder?.display_order || 0) + 1;

    const { data, error } = await supabase
      .from('l10_rating_participants')
      .insert({
        user_id,
        user_name,
        display_order: nextOrder,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding rating participant:', error);
      return NextResponse.json({ error: 'Failed to add participant' }, { status: 500 });
    }

    return NextResponse.json({ participant: data });
  } catch (error) {
    console.error('Error in rating participants POST:', error);
    return NextResponse.json({ error: 'Failed to add participant' }, { status: 500 });
  }
}
