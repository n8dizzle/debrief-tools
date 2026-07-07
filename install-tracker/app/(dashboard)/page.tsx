import InstallTimeline from '@/components/InstallTimeline';
import { getInstallStages } from '@/lib/install-data';

// Server component: read the install map from the database (falls back to seed).
export const dynamic = 'force-dynamic';

export default async function Page() {
  const { stages, source } = await getInstallStages();

  return (
    <div className="wrap">
      <div className="pagehead">
        <h1>Install Pipeline</h1>
        <p className="desc">
          The install process, end to end. Start at the top — the seven stages — then click any
          stage to see what happens inside it. This map grows as we learn each step.
        </p>
      </div>

      <div className="legend" aria-hidden="true">
        <span><i className="sw" style={{ background: 'var(--good)' }} />Done</span>
        <span><i className="sw" style={{ background: 'var(--ember)' }} />Active now</span>
        <span><i className="sw" style={{ background: 'var(--wait)' }} />Waiting</span>
        <span><i className="sw" style={{ background: 'var(--blocked)' }} />Blocked</span>
      </div>

      <InstallTimeline stages={stages} fromDb={source === 'db'} />

      <p className="foot-note">
        {source === 'db'
          ? 'Map loaded from the install_nodes table. Statuses are illustrative.'
          : 'Showing seed data (database not reachable). Statuses are illustrative.'}
      </p>
    </div>
  );
}
