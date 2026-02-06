import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getServerSupabase, TrackerTemplate } from '@/lib/supabase';
import CreateTrackerForm from '@/components/staff/CreateTrackerForm';

async function getTemplates(): Promise<TrackerTemplate[]> {
  const supabase = getServerSupabase();

  const { data } = await supabase
    .from('tracker_templates')
    .select('*')
    .eq('is_active', true)
    .order('trade')
    .order('job_type');

  return data || [];
}

export default async function NewTrackerPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const templates = await getTemplates();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Create New Tracker</h1>
        <p className="text-text-secondary mt-1">Create a new job tracker for a customer</p>
      </div>

      <CreateTrackerForm templates={templates} userId={session.user.id} />
    </div>
  );
}
