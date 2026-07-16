import Link from 'next/link';
import { getDeals, getTriageCounts, TRIAGE_STATUSES, type TriageStatus } from '@/lib/deals';
import DealsTable from '@/components/DealsTable';

export const dynamic = 'force-dynamic';

const TABS: { key: TriageStatus; label: string }[] = [
  { key: 'untriaged', label: 'Needs Triage' },
  { key: 'full_system', label: 'Full System' },
  { key: 'partial', label: 'Partial' },
  { key: 'warranty', label: 'Warranty' },
  { key: 'archived', label: 'Archived' },
];

const DESC: Record<TriageStatus, string> = {
  untriaged: 'Every sold deal from ServiceTitan lands here. The classifier suggests a workflow — confirm it or route it somewhere else. Nothing is dropped.',
  full_system: 'Complete-system installs running the Full System workflow.',
  partial: 'Partial replacements (e.g. AC + coil) — their own lighter workflow.',
  warranty: 'Warranty go-backs — their own workflow.',
  archived: 'Deals deliberately not tracked (service, one-offs). Recoverable anytime.',
};

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const tab = (TRIAGE_STATUSES.includes(sp.status as TriageStatus) ? sp.status : 'untriaged') as TriageStatus;
  const [deals, counts] = await Promise.all([getDeals(tab), getTriageCounts()]);

  return (
    <div className="wrap">
      <div className="pagehead">
        <h1>Deals</h1>
        <p className="desc">{DESC[tab]}</p>
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
