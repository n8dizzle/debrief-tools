import Link from 'next/link';
import { getInstallStages } from '@/lib/install-data';
import { getProjectEstimates, fmtMoney, stJobUrl, stProjectUrl } from '@/lib/jobs';
import { getDeal, getDealStepStatus, deriveDealPipeline, WORKFLOW_LABEL } from '@/lib/deals';
import DealPipeline from '@/components/DealPipeline';

export const dynamic = 'force-dynamic';

export default async function DealPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const pid = Number(projectId);
  const [{ stages }, deal] = await Promise.all([getInstallStages(), getDeal(pid)]);

  if (!deal) {
    return (
      <div className="wrap">
        <p className="lede">Deal not found.</p>
        <Link className="joblink" href="/deals">← Back to deals</Link>
      </div>
    );
  }

  const [estimates, stepStatus] = await Promise.all([getProjectEstimates(pid), getDealStepStatus(pid)]);
  const pipeline = deriveDealPipeline(stages, deal, stepStatus);

  const allSteps = pipeline.flatMap((s) => s.subSteps);
  const autoCount = allSteps.filter((s) => s.auto).length;
  const manualCount = allSteps.filter((s) => !s.auto).length;

  return (
    <div className="wrap">
      <div className="pagehead">
        <Link className="joblink" href="/deals">← All deals</Link>
        <h1 style={{ marginTop: 10 }}>{deal.customer_name || `Project ${deal.st_project_id}`}</h1>
      </div>

      <div className="jobhdr">
        <div className="jobmeta">
          <span>Workflow <b>{WORKFLOW_LABEL[deal.triage_status] ?? deal.triage_status}</b></span>
          <span>Sold by <b>{deal.sold_by_name || '—'}</b></span>
          <span>Business unit <b>{deal.primary_business_unit || '—'}</b></span>
          <span>Contract <b>{fmtMoney(deal.contract_total) ?? '—'}</b></span>
          <span>Systems <b>{deal.system_count ?? 0}</b></span>
          <span>Components <b>{deal.equipment_unit_count ?? 0}</b></span>
          <span>Payment <b>{deal.debrief_payment_type.length ? deal.debrief_payment_type.join(', ') : <span className="pay-missing">⚠ Not filled</span>}</b></span>
          {deal.install_job_status && <span>Install job <b>{deal.install_job_status}</b></span>}
        </div>
        <div className="joblinks">
          <a href={stProjectUrl(deal.st_project_id)} target="_blank" rel="noopener noreferrer" className="stlink">Project #{deal.st_project_id} ↗</a>
          {deal.install_job_number && (
            <a href={stJobUrl(deal.install_job_number)} target="_blank" rel="noopener noreferrer" className="stlink">Install job #{deal.install_job_number} ↗</a>
          )}
        </div>
      </div>

      <p className="callout">
        ServiceTitan auto-ticks <b>{autoCount}</b> of these sub-steps. The <b>{manualCount}</b> it can&apos;t see
        are manual checkboxes this tracker exists to catch. <b>Click a stage to expand its checklist.</b>
      </p>

      <DealPipeline stages={pipeline} estimates={estimates} projectId={pid} />

      <p className="foot-note">
        Deal built entirely from the install tracker&apos;s own data (install_deals + install_estimates,
        synced directly from ServiceTitan). No dependency on other apps.
      </p>
    </div>
  );
}
