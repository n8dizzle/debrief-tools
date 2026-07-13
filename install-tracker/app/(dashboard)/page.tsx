import Link from 'next/link';
import InstallTimeline from '@/components/InstallTimeline';
import { getInstallStages } from '@/lib/install-data';

// Server component: read the install map from the database (falls back to seed).
export const dynamic = 'force-dynamic';

type WorkflowKey = 'full_system' | 'partial' | 'warranty';
const WORKFLOWS: { key: WorkflowKey; label: string }[] = [
  { key: 'full_system', label: 'Full System' },
  { key: 'partial', label: 'Partial' },
  { key: 'warranty', label: 'Warranty' },
];
// What each stubbed pipeline will eventually map (shown on the placeholder).
const STUB: Record<Exclude<WorkflowKey, 'full_system'>, { blurb: string; note: string }> = {
  partial: {
    blurb: 'Partial replacements — a single AC + coil, a furnace on its own, a standalone condenser.',
    note: 'Fewer stages than a full system: no complete-system commissioning, lighter permitting.',
  },
  warranty: {
    blurb: 'Warranty & go-back visits — diagnose, order the covered part, install, file the claim.',
    note: 'A different shape entirely: parts + manufacturer claim tracking, not a new-system install.',
  },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ workflow?: string }> }) {
  const sp = await searchParams;
  const active: WorkflowKey =
    sp.workflow === 'partial' || sp.workflow === 'warranty' ? sp.workflow : 'full_system';
  const { stages, source } = await getInstallStages();

  return (
    <div className="wrap">
      <div className="pagehead">
        <h1>Install Workflows</h1>
      </div>

      <div className="tabs" role="tablist">
        {WORKFLOWS.map((w) => (
          <Link
            key={w.key}
            href={w.key === 'full_system' ? '/' : `/?workflow=${w.key}`}
            className={`tab ${active === w.key ? 'on' : ''}`}
            role="tab"
            aria-selected={active === w.key}
          >
            {w.label}
            {w.key !== 'full_system' && <span className="tab-count">soon</span>}
          </Link>
        ))}
      </div>

      {active === 'full_system' ? (
        <>
          <div className="legend">
            <span className="legend-lead">How each step gets filled:</span>
            <span><i className="sw src-servicetitan" />ServiceTitan</span>
            <span><i className="sw src-orders" />Orders app</span>
            <span><i className="sw src-debrief" />Debrief form</span>
            <span><i className="sw src-manual" />Manual</span>
          </div>

          <InstallTimeline stages={stages} fromDb={source === 'db'} />
        </>
      ) : (
        <div className="wf-stub">
          <div className="wf-stub-mark">🛠️</div>
          <h2>{WORKFLOWS.find((w) => w.key === active)!.label} Workflow</h2>
          <p className="wf-stub-blurb">{STUB[active].blurb}</p>
          <p className="wf-stub-note">{STUB[active].note}</p>
          <p className="wf-stub-foot">
            We&apos;ll build this template once Full System is dialed in.{' '}
            <Link href="/" className="joblink">← Back to Full System</Link>
          </p>
        </div>
      )}
    </div>
  );
}
