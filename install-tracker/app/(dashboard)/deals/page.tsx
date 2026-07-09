import Link from 'next/link';
import { getDeals, getTriageCounts, type TriageStatus } from '@/lib/deals';
import DealsTable from '@/components/DealsTable';

export const dynamic = 'force-dynamic';

const TABS: { key: TriageStatus; label: string }[] = [
  { key: 'untriaged', label: 'Needs Triage' },
  { key: 'install', label: 'Full Install Pipeline' },
  { key: 'archived', label: 'Archived' },
];

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const tab = (['untriaged', 'install', 'archived'].includes(sp.status || '') ? sp.status : 'untriaged') as TriageStatus;
  const [deals, counts] = await Promise.all([getDeals(tab), getTriageCounts()]);

  const desc: Record<TriageStatus, string> = {
    untriaged: 'Every sold deal from ServiceTitan lands here. Confirm the suggestion or override — dispatch real installs into the pipeline, archive the rest. Nothing is dropped.',
    install: 'Complete-system installs dispatched into the pipeline. Partials and warranty stay in Archived — this tab is full installs only.',
    archived: 'Deals set aside as not-install. Recoverable anytime.',
  };

  return (
    <div className="wrap">
      <div className="pagehead">
        <h1>Deals</h1>
        <p className="desc">{desc[tab]}</p>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <Link key={t.key} href={`/deals?status=${t.key}`} className={`tab ${t.key === tab ? 'on' : ''}`}>
            {t.label} <span className="tab-count">{counts[t.key]}</span>
          </Link>
        ))}
      </div>

      <DealsTable deals={deals} tab={tab} />
    </div>
  );
}
