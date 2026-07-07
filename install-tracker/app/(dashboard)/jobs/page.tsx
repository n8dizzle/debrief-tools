import { getInstallStages } from '@/lib/install-data';
import { getInstallJobs, deriveJobStages, jobCurrentStage, fmtMoney } from '@/lib/jobs';
import JobsTable, { type JobRow } from '@/components/JobsTable';

export const dynamic = 'force-dynamic';

export default async function JobsPage() {
  const [{ stages }, jobs] = await Promise.all([getInstallStages(), getInstallJobs(200)]);

  const rows: JobRow[] = jobs.map((job) => ({
    stJobId: job.st_job_id,
    jobNumber: job.job_number ?? String(job.st_job_id),
    customer: job.customer_name ?? '—',
    type: job.business_unit_name ?? job.job_type_name ?? '—',
    total: job.job_total != null ? Number(job.job_total) : null,
    totalLabel: fmtMoney(job.job_total) ?? '—',
    currentStage: jobCurrentStage(deriveJobStages(stages, job)),
  }));

  return (
    <div className="wrap">
      <div className="pagehead">
        <h1>HVAC Install Jobs</h1>
        <p className="desc">
          Live <b>HVAC install</b> jobs synced from ServiceTitan, placed on the pipeline you built.
          Sort, reorder, and resize columns; filter with the search and stage picker. Click a job to open it.
        </p>
      </div>

      <JobsTable rows={rows} />
    </div>
  );
}
