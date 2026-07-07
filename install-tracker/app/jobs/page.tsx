import Link from 'next/link';
import { getInstallStages } from '@/lib/install-data';
import { getInstallJobs, deriveJobStages, jobCurrentStage, fmtMoney } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

export default async function JobsPage() {
  const [{ stages }, jobs] = await Promise.all([getInstallStages(), getInstallJobs(60)]);

  return (
    <main className="wrap">
      <header className="masthead">
        <div className="mark">IA</div>
        <div>
          <div className="title">Install Tracker · Jobs</div>
          <div className="url">real jobs, from ServiceTitan</div>
        </div>
        <Link className="navlink" href="/">← Pipeline map</Link>
      </header>

      <p className="lede">
        Live install jobs synced from ServiceTitan. Each one is placed on the pipeline you built —
        ServiceTitan advances the stages it can see; the rest is yours to fill in. Click a job to see it.
      </p>

      <div className="jobs-scroll">
        <table className="jobs-table">
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
                  <td><span className="stage-chip">{current}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {jobs.length === 0 && <p className="lede">No jobs found (database not reachable, or nothing synced).</p>}
      </div>
    </main>
  );
}
