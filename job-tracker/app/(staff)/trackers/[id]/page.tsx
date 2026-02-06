import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getServerSupabase, JobTracker, TrackerMilestone, TrackerActivity } from '@/lib/supabase';
import TrackerDetail from '@/components/staff/TrackerDetail';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getTracker(id: string) {
  const supabase = getServerSupabase();

  const { data: tracker, error } = await supabase
    .from('job_trackers')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !tracker) {
    return null;
  }

  const { data: milestones } = await supabase
    .from('tracker_milestones')
    .select('*')
    .eq('tracker_id', id)
    .order('sort_order', { ascending: true });

  const { data: activity } = await supabase
    .from('tracker_activity')
    .select('*')
    .eq('tracker_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  return {
    ...tracker,
    milestones: milestones || [],
    activity: activity || [],
  } as JobTracker & { milestones: TrackerMilestone[]; activity: TrackerActivity[] };
}

export default async function TrackerDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;
  const tracker = await getTracker(id);

  if (!tracker) {
    notFound();
  }

  return (
    <div>
      <TrackerDetail tracker={tracker} />
    </div>
  );
}
