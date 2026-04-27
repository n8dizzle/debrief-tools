import { notFound } from 'next/navigation';
import { AppError } from '@/lib/errors';
import { getPurchaseOrder } from '@/lib/services/purchase-orders';
import { PageHeader, Card, DataRow, Table, THead, TBody, Th, Td, EmptyState, StatusBadge } from '@/components/ui';
import { formatMoney, formatDateTime, titleCase } from '@/lib/format';
import POActions from './POActions';

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let detail;
  try {
    detail = await getPurchaseOrder(id);
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) notFound();
    throw e;
  }

  const po = detail.purchase_order as Record<string, unknown>;
  const lines = detail.lines;

  return (
    <div className="px-8 py-6">
      <PageHeader
        title={po.po_number as string}
        description={`${po.supply_house_name as string} · ${titleCase(po.department as string)}`}
        back={{ href: '/purchase-orders', label: 'Back to POs' }}
        actions={<StatusBadge status={po.status as string} />}
      />

      <div className="mb-6">
        <POActions
          poId={id}
          status={po.status as string}
          lines={lines.map((l) => {
            const r = l as Record<string, unknown>;
            return {
              id: r.id as string,
              sku: (r.sku as string) ?? null,
              material_name: r.material_name as string,
              quantity_ordered: Number(r.quantity_ordered ?? 0),
              quantity_received: Number(r.quantity_received ?? 0),
            };
          })}
        />
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title="Header">
          <dl className="text-sm">
            <DataRow label="Supplier" value={(po.supply_house_name as string) ?? '—'} />
            <DataRow label="Email" value={(po.contact_email as string) ?? '—'} />
            <DataRow label="Warehouse" value={(po.warehouse_name as string) ?? '—'} />
            <DataRow label="Department" value={titleCase(po.department as string)} />
            <DataRow label="Trigger" value={titleCase((po.trigger_type as string) ?? '—')} />
          </dl>
        </Card>

        <Card title="Timeline">
          <dl className="text-sm">
            <DataRow label="Created" value={formatDateTime(po.created_at as string)} />
            <DataRow label="Review by" value={formatDateTime(po.review_deadline as string | null)} />
            <DataRow label="Sent" value={formatDateTime(po.sent_at as string | null)} />
            <DataRow label="Received" value={formatDateTime(po.received_at as string | null)} />
          </dl>
        </Card>

        <Card title="Totals">
          <dl className="text-sm">
            <DataRow label="Subtotal" value={formatMoney(po.subtotal as number | string)} />
            <DataRow label="Total" value={formatMoney(po.total as number | string)} />
            <DataRow label="Lines" value={String(lines.length)} />
          </dl>
          {po.notes ? (
            <div className="mt-3 pt-3 border-t border-border-subtle">
              <div className="text-xs uppercase tracking-wide text-text-muted mb-1">Notes</div>
              <p className="text-sm text-text-secondary whitespace-pre-line">{po.notes as string}</p>
            </div>
          ) : null}
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-medium text-text-primary mb-3">Line items</h2>
        <Table>
          <THead>
            <tr>
              <Th>SKU</Th>
              <Th>Material</Th>
              <Th align="right">Qty ordered</Th>
              <Th align="right">Qty received</Th>
              <Th align="right">Unit cost</Th>
              <Th align="right">Line total</Th>
              <Th>Notes</Th>
            </tr>
          </THead>
          <TBody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState message="This PO has no line items yet." />
                </td>
              </tr>
            )}
            {lines.map((row) => {
              const l = row as Record<string, unknown>;
              return (
                <tr key={l.id as string} className="hover:bg-bg-card-hover transition">
                  <Td mono muted>{(l.sku as string) ?? '—'}</Td>
                  <Td>{l.material_name as string}</Td>
                  <Td align="right">{l.quantity_ordered as number}</Td>
                  <Td align="right">{l.quantity_received as number}</Td>
                  <Td align="right">{formatMoney(l.unit_cost as number | string)}</Td>
                  <Td align="right">{formatMoney(l.line_total as number | string)}</Td>
                  <Td muted>{(l.notes as string) ?? '—'}</Td>
                </tr>
              );
            })}
          </TBody>
        </Table>
      </section>
    </div>
  );
}
