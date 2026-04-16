import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

// DELETE /api/l10/ratings/participants/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const { error } = await supabase
      .from('l10_rating_participants')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Error deleting rating participant:', error);
      return NextResponse.json({ error: 'Failed to delete participant' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in rating participant DELETE:', error);
    return NextResponse.json({ error: 'Failed to delete participant' }, { status: 500 });
  }
}
