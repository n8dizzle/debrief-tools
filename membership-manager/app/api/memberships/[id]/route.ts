import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServerSupabase();

  // Get membership
  const { data: membership, error } = await supabase
    .from('mm_memberships')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !membership) {
    return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
  }

  // Get recurring services
  const { data: services } = await supabase
    .from('mm_recurring_services')
    .select('*')
    .eq('st_membership_id', membership.st_membership_id)
    .order('name');

  // Get events
  const { data: events } = await supabase
    .from('mm_recurring_service_events')
    .select('*')
    .eq('st_membership_id', membership.st_membership_id)
    .order('scheduled_date', { ascending: false });

  // Get staff notes
  const { data: notes } = await supabase
    .from('mm_staff_notes')
    .select('*')
    .eq('membership_id', id)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    membership,
    services: services || [],
    events: events || [],
    notes: notes || [],
  });
}
