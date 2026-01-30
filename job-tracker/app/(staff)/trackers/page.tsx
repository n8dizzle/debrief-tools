import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { getServerSupabase, JobTracker } from '@/lib/supabase';
import TrackerList from '@/components/staff/TrackerList';

interface SearchParams {
  status?: string;
  trade?: string;
  search?: string;
}

async function getTrackers(searchParams: SearchParams): Promise<JobTracker[]> {
  const supabase = getServerSupabase();

  let query = supabase
    .from('job_trackers')
    .select('*')
    .order('created_at', { ascending: false });

  if (searchParams.status && searchParams.status !== 'all') {
    query = query.eq('status', searchParams.status);
  }

  if (searchParams.trade && searchParams.trade !== 'all') {
    query = query.eq('trade', searchParams.trade);
  }

  if (searchParams.search) {
    query = query.or(
      `customer_name.ilike.%${searchParams.search}%,job_number.ilike.%${searchParams.search}%,tracking_code.ilike.%${searchParams.search}%`
    );
  }

  const { data } = await query.limit(100);
  return data || [];
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function TrackersPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const params = await searchParams;
  const trackers = await getTrackers(params);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Trackers</h1>
          <p className="text-text-secondary mt-1">Manage job trackers</p>
        </div>
        <Link href="/trackers/new" className="btn btn-primary flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Tracker
        </Link>
      </div>

      <TrackerList initialTrackers={trackers} initialFilters={params} />
    </div>
  );
}
