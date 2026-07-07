import Link from 'next/link';
import { getInstallStages } from '@/lib/install-data';
import { getInstallJob, deriveJobStages, fmtMoney } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

const SOURCE_LABEL = { st: 'ServiceTitan', partial: 'ServiceTitan + ap-payments', manual: 'Manual — ST is blind' };

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stJobId = Number(id);
  const [{ stages }, job] = await Promise.all([getInstallStages(), getInstallJob(stJobId)]);

  if (!job) {
    return (
      <div className="wrap">
        <p className="lede">Job not found (not an HVAC install, or not synced).</p>
        <Link className="joblink" href="/jobs">← Back to jobs</Link>
      </div>
    );
  }

  const jobStages = deriveJobStages(stages, job);
  const autoCount = jobStages.filter((s) => s.source !== 'manual').length;
  const gapCount = jobStages.filter((s) => s.source === 'manual').length;

  return (
    <div className="wrap">
      <div className="pagehead">
        <Link className="joblink" href="/jobs">← All jobs</Link>
        <h1 style={{ marginTop: 10 }}>Job #{job.job_number ?? job.st_job_id}</h1>
      </div>

      <div className="jobhdr">
        <div className="jobmeta">
          <span>Customer <b>{job.customer_name ?? '—'}</b></span>
          <span>Type <b>{job.business_unit_name ?? job.job_type_name ?? '—'}</b></span>
          <span>Total <b>{fmtMoney(job.job_total) ?? '—'}</b></span>
          {job.sold_estimate_job_number && <span>Sold estimate <b>#{job.sold_estimate_job_number}</b></span>}
          <span>Status <b>{job.job_status ?? '—'}</b></span>
        </div>
      </div>

      <p className="callout">
        ServiceTitan auto-fills <b>{autoCount}</b> of these stages. The <b>{gapCount}</b> it can&apos;t see
        are the ones this tracker exists to catch.
      </p>

      <div className="jp-flow">
        {jobStages.map((s, i) => (
          <div className="jp-step" key={`${s.name}-${i}`}>
            <div className={`jp-dot ${s.status}`}>{s.status === 'done' ? '✓' : s.status === 'gap' ? '?' : '●'}</div>
            <div className={`jp-card ${s.source === 'manual' ? 'gapcard' : ''}`}>
              <div className="jp-head">
                <span className="jp-name">{s.name}</span>
                <span className={`src ${s.source}`}>{SOURCE_LABEL[s.source]}</span>
              </div>
              {s.value && <div className="jp-val">{s.value}</div>}
              {s.source === 'manual' && s.note && <div className="jp-note">{s.note}</div>}
              {s.source === 'partial' && s.note && <div className="jp-note">{s.note}</div>}
            </div>
          </div>
        ))}
      </div>

      <p className="foot-note">
        Read-only view from ap_install_jobs (synced from ServiceTitan). Stage structure comes from the
        map you built — rename or reorder stages there and this view follows.
      </p>
    </div>
  );
}
