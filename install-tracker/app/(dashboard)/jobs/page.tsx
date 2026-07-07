import Link from 'next/link';
import { getInstallStages } from '@/lib/install-data';
import { getInstallJobs, deriveJobStages, jobCurrentStage, fmtMoney } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

export default async function JobsPage() {
  const [{ stages }, jobs] = await Promise.all([getInstallStages(), getInstallJobs(60)]);

  return (
    <div className="wrap">
      <div className="pagehead">
        <h1>HVAC Install Jobs</h1>
        <p className="desc">
          Live <b>HVAC install</b> jobs synced from ServiceTitan. Each one sits on the pipeline you built —
          ServiceTitan advances the stages it can see; the rest is yours to fill in. Click a job to open it.
        </p>
      </div>

      <div className="jobs-scroll">
        <table className="ar-table">
          <thead>
            <tr>
              <th>Job</th><th>Customer</th><th>Type</th><th className="num">Total</th><th>Current stage</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const current = jobCurrentStage(deriveJobStages(stages, job));
              return (
                <tr key={job.st_job_id}>
                  <td><Link className="joblink" href={`/jobs/${job.st_job_id}`}>#{job.job_number ?? job.st_job_id}</Link></td>
                  <td className="cust">{job.customer_name ?? '—'}</td>
                  <td className="muted">{job.business_unit_name ?? job.job_type_name ?? '—'}</td>
                  <td className="num">{fmtMoney(job.job_total) ?? '—'}</td>
                  <td><span className="badge badge-stage">{current}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {jobs.length === 0 && <p className="lede">No jobs found (database not reachable, or nothing synced).</p>}
      </div>
    </div>
  );
}
