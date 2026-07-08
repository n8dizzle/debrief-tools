import Link from 'next/link';
import { getInstallStages } from '@/lib/install-data';
import { getInstallJob, deriveJobStages, fmtMoney, stJobUrl, stProjectUrl } from '@/lib/jobs';
import JobPipeline from '@/components/JobPipeline';

export const dynamic = 'force-dynamic';

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
          <span>Job type <b>{job.job_type_name ?? '—'}</b></span>
          <span>Business unit <b>{job.business_unit_name ?? '—'}</b></span>
          <span>Total <b>{fmtMoney(job.job_total) ?? '—'}</b></span>
          <span>Status <b>{job.job_status ?? '—'}</b></span>
        </div>
        <div className="joblinks">
          {job.st_project_id != null && (
            <a href={stProjectUrl(job.st_project_id)} target="_blank" rel="noopener noreferrer" className="stlink">
              Project #{job.st_project_id} ↗
            </a>
          )}
          <a href={stJobUrl(job.st_job_id)} target="_blank" rel="noopener noreferrer" className="stlink">
            Install job ↗
          </a>
          {job.sold_estimate_job_number && (
            <a href={stJobUrl(job.sold_estimate_job_number)} target="_blank" rel="noopener noreferrer" className="stlink">
              Sold estimate #{job.sold_estimate_job_number} ↗
            </a>
          )}
        </div>
      </div>

      <p className="callout">
        ServiceTitan auto-fills <b>{autoCount}</b> of these stages. The <b>{gapCount}</b> it can&apos;t see
        are the ones this tracker exists to catch. <b>Click a stage to expand its details.</b>
      </p>

      <JobPipeline stages={jobStages} />

      <p className="foot-note">
        Read-only view from ap_install_jobs (synced from ServiceTitan). Stage structure comes from the
        map you built — rename or reorder stages there and this view follows. ServiceTitan links open in
        a new tab (Project link is best-effort — tell me if it doesn&apos;t resolve).
      </p>
    </div>
  );
}
