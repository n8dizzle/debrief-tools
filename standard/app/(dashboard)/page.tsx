import Link from 'next/link';
import InstallTimeline from '@/components/InstallTimeline';
import { getInstallStages, getBuiltWorkflows } from '@/lib/install-data';

// Server component: read the install map from the database (falls back to seed).
export const dynamic = 'force-dynamic';

type WorkflowKey = 'full_system' | 'partial' | 'warranty' | 'service_parts' | 'install_recall' | 'service_recall';
const WORKFLOWS: { key: WorkflowKey; label: string; group: 'Install' | 'Recall' }[] = [
  { key: 'full_system', label: 'Full System', group: 'Install' },
  { key: 'partial', label: 'Partial', group: 'Install' },
  { key: 'warranty', label: 'Warranty', group: 'Install' },
  { key: 'service_parts', label: 'Service — Parts', group: 'Install' },
  { key: 'install_recall', label: 'Install Recall', group: 'Recall' },
  { key: 'service_recall', label: 'Service Recall', group: 'Recall' },
];
// Placeholder copy for any workflow not yet built.
const STUB: Record<Exclude<WorkflowKey, 'full_system'>, { blurb: string; note: string }> = {
  partial: {
    blurb: 'Partial replacements — a single AC + coil, a furnace on its own, a standalone condenser.',
    note: 'Fewer stages than a full system: no complete-system commissioning, lighter permitting.',
  },
  warranty: {
    blurb: 'Warranty & go-back visits — diagnose, order the covered part, install, file the claim.',
    note: 'A different shape entirely: parts + manufacturer claim tracking, not a new-system install.',
  },
  service_parts: {
    blurb: 'Service repairs waiting on a part — the slice of service that can’t be booked until the part is ordered and arrives.',
    note: 'Mirrors the orders app’s service flow: approve → order part → receive → schedule → repair.',
  },
  install_recall: {
    blurb: 'Recalls caused by an install — auto-flagged, AI root cause, then human validation and accountability.',
    note: 'The flow view; the deep root-cause analysis lives in the Service Dashboard.',
  },
  service_recall: {
    blurb: 'Recalls on a service or maintenance job — fast loop, tech-quality focus.',
    note: 'A sub-7-day recall is a near-certain quality miss and flags the tech.',
  },
};
const WORKFLOW_KEYS: WorkflowKey[] = ['full_system', 'partial', 'warranty', 'service_parts', 'install_recall', 'service_recall'];

export default async function Page({ searchParams }: { searchParams: Promise<{ workflow?: string }> }) {
  const sp = await searchParams;
  const active: WorkflowKey =
    WORKFLOW_KEYS.includes(sp.workflow as WorkflowKey) ? (sp.workflow as WorkflowKey) : 'full_system';
  const [{ stages, source }, built] = await Promise.all([getInstallStages(active), getBuiltWorkflows()]);
  const hasTemplate = stages.length > 0;

  return (
    <div className="wrap">
      <div className="pagehead">
        <h1>Workflows</h1>
      </div>

      <div className="tabs" role="tablist">
        {WORKFLOWS.map((w, i) => (
          <div key={w.key} style={{ display: 'contents' }}>
            {i > 0 && WORKFLOWS[i - 1].group !== w.group && <span className="tab-sep" aria-hidden="true" />}
            <Link
              href={w.key === 'full_system' ? '/' : `/?workflow=${w.key}`}
              className={`tab ${active === w.key ? 'on' : ''}`}
              role="tab"
              aria-selected={active === w.key}
            >
              {w.label}
              {!built.has(w.key) && <span className="tab-count">soon</span>}
            </Link>
          </div>
        ))}
      </div>

      {hasTemplate ? (
        <>
          <div className="legend">
            <span className="legend-lead">How each step gets filled:</span>
            <span><i className="sw src-servicetitan" />ServiceTitan</span>
            <span><i className="sw src-orders" />Orders app</span>
            <span><i className="sw src-debrief" />Debrief form</span>
            <span><i className="sw src-ai" />AI</span>
            <span><i className="sw src-manual" />Manual</span>
          </div>

          <InstallTimeline stages={stages} fromDb={source === 'db'} workflow={active} />
        </>
      ) : (
        <div className="wf-stub">
          <div className="wf-stub-mark">🛠️</div>
          <h2>{WORKFLOWS.find((w) => w.key === active)!.label} Workflow</h2>
          <p className="wf-stub-blurb">{STUB[active as Exclude<WorkflowKey, 'full_system'>].blurb}</p>
          <p className="wf-stub-note">{STUB[active as Exclude<WorkflowKey, 'full_system'>].note}</p>
          <p className="wf-stub-foot">
            We&apos;ll build this template once Full System is dialed in.{' '}
            <Link href="/" className="joblink">← Back to Full System</Link>
          </p>
        </div>
      )}
    </div>
  );
}
