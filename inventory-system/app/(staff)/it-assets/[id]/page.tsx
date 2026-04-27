import { notFound } from 'next/navigation';
import { AppError } from '@/lib/errors';
import { getItAsset } from '@/lib/services/it-assets';
import { PageHeader, Card, DataRow, Table, THead, TBody, Th, Td, EmptyState, StatusBadge } from '@/components/ui';
import { titleCase, formatDate, formatDateTime, formatMoney } from '@/lib/format';

export default async function ItAssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let detail;
  try {
    detail = await getItAsset(id);
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) notFound();
    throw e;
  }

  const a = detail.asset as Record<string, unknown>;

  return (
    <div className="px-8 py-6">
      <PageHeader
        title={`${a.manufacturer as string} ${a.model as string}`}
        description={`${titleCase(a.asset_type as string)} · SN ${a.serial_number as string}`}
        back={{ href: '/it-assets', label: 'Back to IT assets' }}
        actions={<StatusBadge status={a.status as string} />}
      />

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title="Identification">
          <dl className="text-sm">
            <DataRow label="Type" value={titleCase(a.asset_type as string)} />
            <DataRow label="Asset tag" value={(a.asset_tag as string) ?? '—'} />
            <DataRow label="Serial #" value={(a.serial_number as string) ?? '—'} />
            <DataRow label="IMEI" value={(a.imei as string) ?? '—'} />
            <DataRow label="UDID" value={(a.udid as string) ?? '—'} />
            <DataRow label="Department" value={titleCase((a.department as string) ?? '—')} />
          </dl>
        </Card>

        <Card title="Lifecycle">
          <dl className="text-sm">
            <DataRow label="Status" value={titleCase(a.status as string)} />
            <DataRow label="Purchased" value={formatDate(a.purchase_date as string | null)} />
            <DataRow label="Cost" value={formatMoney(a.purchase_cost as number | string | null)} />
            <DataRow label="Vendor" value={(a.vendor as string) ?? '—'} />
            <DataRow label="Warranty" value={formatDate(a.warranty_expiry as string | null)} />
            <DataRow label="MDM enrolled" value={a.mdm_enrolled ? 'Yes' : 'No'} />
          </dl>
        </Card>

        <Card title="Phone (mobile only)">
          <dl className="text-sm">
            <DataRow label="Carrier" value={(a.carrier as string) ?? '—'} />
            <DataRow label="Number" value={(a.phone_number as string) ?? '—'} />
          </dl>
          {a.notes ? (
            <div className="mt-3 pt-3 border-t border-border-subtle">
              <div className="text-xs uppercase tracking-wide text-text-muted mb-1">Notes</div>
              <p className="text-sm text-text-secondary whitespace-pre-line">{a.notes as string}</p>
            </div>
          ) : null}
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-medium text-text-primary mb-3">Assignment history</h2>
        <Table>
          <THead>
            <tr>
              <Th>Assigned</Th>
              <Th>To</Th>
              <Th>By</Th>
              <Th>Returned</Th>
              <Th>Notes</Th>
            </tr>
          </THead>
          <TBody>
            {detail.history.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState message="No assignment history." />
                </td>
              </tr>
            )}
            {detail.history.map((row) => {
              const h = row as Record<string, unknown>;
              return (
                <tr key={h.id as string} className="hover:bg-bg-card-hover transition">
                  <Td muted>{formatDateTime(h.assigned_at as string)}</Td>
                  <Td>{(h.assigned_to_name as string) ?? '—'}</Td>
                  <Td muted>{(h.assigned_by_name as string) ?? '—'}</Td>
                  <Td muted>{formatDateTime(h.returned_at as string | null)}</Td>
                  <Td muted>{(h.notes as string) ?? (h.return_notes as string) ?? '—'}</Td>
                </tr>
              );
            })}
          </TBody>
        </Table>
      </section>
    </div>
  );
}
