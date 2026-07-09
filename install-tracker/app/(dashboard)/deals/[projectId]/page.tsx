import Link from 'next/link';
import { getInstallStages } from '@/lib/install-data';
import { getProjectEstimates, fmtMoney, stJobUrl, stProjectUrl } from '@/lib/jobs';
import { getDeal, deriveDealStages } from '@/lib/deals';
import JobPipeline from '@/components/JobPipeline';

export const dynamic = 'force-dynamic';

const TRIAGE_LABEL: Record<string, string> = {
  untriaged: 'Needs triage', install: 'In install pipeline', archived: 'Archived',
};

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

  const estimates = await getProjectEstimates(pid);
  const jobStages = deriveDealStages(stages, deal);

  // Multi-estimate-aware Sold summary line — systems/components from the deal's classified counts.
  const soldEst = estimates.filter((e) => e.status === 'Sold');
  if (soldEst.length) {
    const total = soldEst.reduce((s, e) => s + (e.subtotal ?? 0), 0);
    const sys = deal.system_count ?? 0;
    const comp = deal.equipment_unit_count ?? 0;
    const soldStage = jobStages.find((s) => s.name.toLowerCase().includes('sold'));
    if (soldStage) soldStage.value = `${soldEst.length} sold estimate${soldEst.length === 1 ? '' : 's'} · ${sys} system${sys === 1 ? '' : 's'} · ${comp} component${comp === 1 ? '' : 's'} · ${fmtMoney(total)}`;
  }

  const autoCount = jobStages.filter((s) => s.source !== 'manual').length;
  const gapCount = jobStages.filter((s) => s.source === 'manual').length;

  return (
    <div className="wrap">
      <div className="pagehead">
        <Link className="joblink" href="/deals">← All deals</Link>
        <h1 style={{ marginTop: 10 }}>{deal.customer_name || `Project ${deal.st_project_id}`}</h1>
      </div>

      <div className="jobhdr">
        <div className="jobmeta">
          <span>Status <b>{TRIAGE_LABEL[deal.triage_status] ?? deal.triage_status}</b></span>
          <span>Sold by <b>{deal.sold_by_name || '—'}</b></span>
          <span>Business unit <b>{deal.primary_business_unit || '—'}</b></span>
          <span>Contract <b>{fmtMoney(deal.contract_total) ?? '—'}</b></span>
          <span>Systems <b>{deal.system_count ?? 0}</b></span>
          <span>Components <b>{deal.equipment_unit_count ?? 0}</b></span>
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
        ServiceTitan auto-fills <b>{autoCount}</b> of these stages. The <b>{gapCount}</b> it can&apos;t see
        are the ones this tracker exists to catch. <b>Click a stage to expand its details.</b>
      </p>

      <JobPipeline stages={jobStages} estimates={estimates} />

      <p className="foot-note">
        Deal built entirely from the install tracker&apos;s own data (install_deals + install_estimates,
        synced directly from ServiceTitan). No dependency on other apps.
      </p>
    </div>
  );
}
