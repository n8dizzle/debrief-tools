import { notFound } from 'next/navigation';
import { AppError } from '@/lib/errors';
import { getSupplyHouse } from '@/lib/services/supply-houses';
import { PageHeader, Card, DataRow, StatusBadge } from '@/components/ui';
import { titleCase } from '@/lib/format';

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let v;
  try {
    v = await getSupplyHouse(id);
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) notFound();
    throw e;
  }

  return (
    <div className="px-8 py-6">
      <PageHeader
        title={v.name}
        description={titleCase(v.department ?? '—')}
        back={{ href: '/vendors', label: 'Back to vendors' }}
        actions={<StatusBadge status={v.is_active ? 'active' : 'inactive'} />}
      />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Contact">
          <dl className="text-sm">
            <DataRow label="Contact" value={v.contact_name ?? '—'} />
            <DataRow label="Email" value={v.contact_email} />
            <DataRow label="Phone" value={v.contact_phone ?? '—'} />
            <DataRow label="Account #" value={v.account_number ?? '—'} />
          </dl>
        </Card>

        <Card title="Ordering">
          <dl className="text-sm">
            <DataRow label="Lead time" value={v.lead_time_days != null ? `${v.lead_time_days} days` : '—'} />
            <DataRow
              label="Preferred PO day"
              value={
                v.preferred_po_day != null
                  ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][v.preferred_po_day - 1] ?? '—'
                  : '—'
              }
            />
            <DataRow label="Department" value={titleCase(v.department ?? '—')} />
          </dl>
          {v.notes && (
            <div className="mt-3 pt-3 border-t border-border-subtle">
              <div className="text-xs uppercase tracking-wide text-text-muted mb-1">Notes</div>
              <p className="text-sm text-text-secondary whitespace-pre-line">{v.notes}</p>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
