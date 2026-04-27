import { notFound } from 'next/navigation';
import { AppError } from '@/lib/errors';
import { getEquipment } from '@/lib/services/equipment';
import { PageHeader, Card, DataRow, StatusBadge } from '@/components/ui';
import { titleCase, formatDate } from '@/lib/format';

export default async function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let e;
  try {
    e = await getEquipment(id);
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 404) notFound();
    throw err;
  }

  return (
    <div className="px-8 py-6">
      <PageHeader
        title={e.name}
        description={[e.manufacturer, e.model].filter(Boolean).join(' · ') || undefined}
        back={{ href: '/equipment', label: 'Back to equipment' }}
        actions={<StatusBadge status={e.status} />}
      />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Identification">
          <dl className="text-sm">
            <DataRow label="Serial #" value={e.serial_number ?? '—'} />
            <DataRow label="Manufacturer" value={e.manufacturer ?? '—'} />
            <DataRow label="Model" value={e.model ?? '—'} />
            <DataRow label="ST equipment id" value={e.st_equipment_id ?? '—'} />
            <DataRow label="ST customer id" value={(e as unknown as Record<string, unknown>).st_customer_id as string ?? '—'} />
          </dl>
        </Card>

        <Card title="Lifecycle">
          <dl className="text-sm">
            <DataRow label="Status" value={titleCase(e.status ?? '—')} />
            <DataRow label="Installed" value={formatDate(e.installed_at)} />
            <DataRow label="Warranty start" value={formatDate(e.warranty_start)} />
            <DataRow label="Warranty expiry" value={formatDate(e.warranty_expiry)} />
            <DataRow label="Installed by" value={e.installed_by_name ?? '—'} />
            <DataRow label="On truck" value={e.installed_truck_number ?? '—'} />
          </dl>
        </Card>

        {e.warehouse_name && (
          <Card title="Stock location">
            <dl className="text-sm">
              <DataRow label="Warehouse" value={e.warehouse_name} />
              <DataRow label="Location" value={e.location_label ?? '—'} />
            </dl>
          </Card>
        )}
      </section>
    </div>
  );
}
