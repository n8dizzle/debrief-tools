import Link from 'next/link';
import { getFullSystemHealth } from '@/lib/health';

export const dynamic = 'force-dynamic';

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default async function HealthPage() {
  const { execution: ex, ar } = await getFullSystemHealth();
  const maxExec = Math.max(ex.soldBooked.count, ex.scheduled.count, 1);
  const w = (n: number) => `${Math.max(14, Math.round((n / maxExec) * 100))}%`;

  const overdue = ar.deals.filter((d) => d.days > 90);
  const rest = ar.deals.filter((d) => d.days <= 90);
  const shown = [...overdue, ...rest.slice(0, Math.max(0, 7 - overdue.length))];
  const hidden = ar.deals.length - shown.length;
  const hiddenAmt = ar.deals.slice(shown.length).reduce((s, d) => s + d.balance, 0);

  return (
    <div className="wrap">
      <div className="pagehead">
        <span className="hh-eyebrow">Full System</span>
        <h1>Workflow Health</h1>
      </div>

      {/* SECTION 1 — install execution */}
      <section className="hh-section">
        <div className="hh-shead">
          <span className="hh-stitle"><span className="hh-ic">▸</span> Install execution</span>
          <span className="hh-tag">{ex.total} in progress</span>
        </div>
        <p className="hh-ssub">Live deals not yet installed. Widest band = where they wait. Ends at Installed — money is handled below.</p>

        <div className="hh-funnel">
          <div className="hh-row">
            <div className="hh-name">Sold &amp; Booked<span className="hh-n2">awaiting prep</span></div>
            <div className="hh-track"><div className="hh-bar fresh" style={{ width: w(ex.soldBooked.count) }}>{ex.soldBooked.count}</div></div>
            <div className="hh-age">{ex.soldBooked.count ? <><span className="hh-dot" />avg {ex.soldBooked.avgAge}d</> : '—'}</div>
          </div>
          <div className="hh-conn"><i /></div>
          <div className="hh-row">
            <div className="hh-name">Permit</div>
            <div className="hh-track"><div className="hh-bar manual">Manual · not tracked</div></div>
            <div className="hh-age gap">no signal yet</div>
          </div>
          <div className="hh-conn"><i /></div>
          <div className="hh-row">
            <div className="hh-name">Equipment</div>
            <div className="hh-track"><div className="hh-bar manual">Orders app</div></div>
            <div className="hh-age gap">from orders app</div>
          </div>
          <div className="hh-conn"><i /></div>
          <div className="hh-row">
            <div className="hh-name">Scheduled<span className="hh-n2">awaiting install day</span></div>
            <div className="hh-track"><div className="hh-bar fresh" style={{ width: w(ex.scheduled.count) }}>{ex.scheduled.count}</div></div>
            <div className="hh-age">{ex.scheduled.count ? <><span className="hh-dot" />avg {ex.scheduled.avgAge}d</> : '—'}</div>
          </div>
          <div className="hh-conn"><i /></div>
          <div className="hh-row">
            <div className="hh-name">Installed<span className="hh-n2">→ hand to billing</span></div>
            <div className="hh-track"><div className="hh-bar zero">{ex.installedAwaitingInvoice}</div></div>
            <div className="hh-age gap">passes through</div>
          </div>
        </div>
        {ex.total > 0 && (ex.soldBooked.avgAge < 7 && ex.scheduled.avgAge < 7) && (
          <div className="hh-good">✓ Install pipeline is healthy — {ex.total} deals moving, all fresh. No install-side jam right now.</div>
        )}
      </section>

      {/* SECTION 2 — awaiting payment */}
      <section className="hh-section">
        <div className="hh-shead">
          <span className="hh-stitle money">$ Awaiting payment</span>
          <span className="hh-tag">{ar.count} invoice{ar.count === 1 ? '' : 's'}</span>
          <span className="hh-tag money">{usd(ar.outstanding)} outstanding</span>
        </div>
        <p className="hh-ssub">Installed &amp; invoiced, balance still owed. Most is normal lag — the aged ones are what to chase.</p>

        <div className="hh-chips">
          <div className={`hh-chip ${ar.buckets.over90 ? 'over' : ''}`}><div className="hh-cn">{ar.buckets.over90}</div><div className="hh-cl">90+ days{ar.buckets.over90 ? ` · ${usd(ar.buckets.over90Amount)}` : ''}</div></div>
          <div className="hh-chip"><div className="hh-cn">{ar.buckets.d60_90}</div><div className="hh-cl">60–90 days</div></div>
          <div className="hh-chip"><div className="hh-cn">{ar.buckets.d30_60}</div><div className="hh-cl">30–60 days</div></div>
          <div className="hh-chip"><div className="hh-cn">{ar.buckets.under30}</div><div className="hh-cl">under 30 · normal</div></div>
        </div>

        {ar.deals.length > 0 ? (
          <table className="hh-table">
            <thead><tr><th>Customer</th><th>Invoice</th><th className="r">Balance</th><th className="r">Days</th></tr></thead>
            <tbody>
              {shown.map((d) => (
                <tr key={d.projectId} className={d.days > 90 ? 'overdue' : ''}>
                  <td className="hh-cust"><Link className="joblink" href={`/deals/${d.projectId}`}>{d.customer}</Link></td>
                  <td className="hh-inv">#{d.invoiceNumber}</td>
                  <td className="r hh-bal">{usd(d.balance)}</td>
                  <td className={`r hh-days ${d.days > 90 ? 'bad' : ''}`}>{d.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="hh-ssub">Nothing awaiting payment right now.</p>}
        {hidden > 0 && <div className="hh-more">+ {hidden} more under {shown[shown.length - 1]?.days ?? 30} days · {usd(hiddenAmt)} (normal payment window)</div>}
      </section>

      <p className="foot-note">
        Live from install_deals. Section 1 places deals at the furthest stage ServiceTitan / the orders app can confirm —
        Permit &amp; Inspection are manual with no signal yet. Section 2 ages from invoice date.
      </p>
    </div>
  );
}
