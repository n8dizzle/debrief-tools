import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

async function getDashboardStats() {
  const supabase = getServerSupabase();

  // Get tracker counts by status
  const { data: trackers } = await supabase
    .from('job_trackers')
    .select('id, status, trade, created_at');

  const stats = {
    total: trackers?.length || 0,
    active: trackers?.filter((t) => t.status === 'active').length || 0,
    completed: trackers?.filter((t) => t.status === 'completed').length || 0,
    hvac: trackers?.filter((t) => t.trade === 'hvac').length || 0,
    plumbing: trackers?.filter((t) => t.trade === 'plumbing').length || 0,
  };

  // Get recent trackers
  const { data: recentTrackers } = await supabase
    .from('job_trackers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  return { stats, recentTrackers: recentTrackers || [] };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const { stats, recentTrackers } = await getDashboardStats();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-text-secondary mt-1">Job tracker overview</p>
        </div>
        <Link
          href="/trackers/new"
          className="btn btn-primary flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Tracker
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="card">
          <p className="text-text-muted text-sm">Total Trackers</p>
          <p className="text-3xl font-bold text-text-primary mt-1">{stats.total}</p>
        </div>
        <div className="card">
          <p className="text-text-muted text-sm">Active</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">{stats.active}</p>
        </div>
        <div className="card">
          <p className="text-text-muted text-sm">Completed</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{stats.completed}</p>
        </div>
        <div className="card">
          <p className="text-text-muted text-sm">HVAC</p>
          <p className="text-3xl font-bold text-christmas-green mt-1">{stats.hvac}</p>
        </div>
        <div className="card">
          <p className="text-text-muted text-sm">Plumbing</p>
          <p className="text-3xl font-bold text-christmas-gold mt-1">{stats.plumbing}</p>
        </div>
      </div>

      {/* Recent Trackers */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Recent Trackers</h2>
          <Link href="/trackers" className="text-sm text-christmas-green-light hover:underline">
            View All
          </Link>
        </div>

        {recentTrackers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-text-muted">No trackers yet</p>
            <Link href="/trackers/new" className="text-christmas-green-light hover:underline text-sm mt-2 inline-block">
              Create your first tracker
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tracker-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Trade</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {recentTrackers.map((tracker) => (
                  <tr key={tracker.id}>
                    <td>
                      <Link
                        href={`/trackers/${tracker.id}`}
                        className="font-medium text-text-primary hover:text-christmas-green-light"
                      >
                        {tracker.customer_name}
                      </Link>
                      {tracker.job_number && (
                        <p className="text-xs text-text-muted">Job #{tracker.job_number}</p>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${tracker.trade === 'hvac' ? 'badge-hvac' : 'badge-plumbing'}`}>
                        {tracker.trade.toUpperCase()}
                      </span>
                    </td>
                    <td className="text-text-secondary capitalize">{tracker.job_type}</td>
                    <td>
                      <span className={`badge badge-${tracker.status === 'active' ? 'in-progress' : tracker.status}`}>
                        {tracker.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-border-default rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${tracker.trade === 'hvac' ? 'bg-christmas-green' : 'bg-christmas-gold'}`}
                            style={{ width: `${tracker.progress_percent}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-muted">{tracker.progress_percent}%</span>
                      </div>
                    </td>
                    <td className="text-text-muted text-sm">
                      {new Date(tracker.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
