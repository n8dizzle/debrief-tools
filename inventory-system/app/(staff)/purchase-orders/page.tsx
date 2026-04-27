import Link from 'next/link';
import { listPurchaseOrders } from '@/lib/services/purchase-orders';
import { PageHeader, Table, THead, TBody, Th, Td, EmptyState, StatusBadge } from '@/components/ui';
import { formatMoney, formatDate, titleCase } from '@/lib/format';

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; department?: string }>;
}) {
  const sp = await searchParams;
  const rows = await listPurchaseOrders({ status: sp.status || null, department: sp.department || null });

  return (
    <div className="px-8 py-6">
      <PageHeader title="Purchase Orders" description={`${rows.length} PO${rows.length === 1 ? '' : 's'}`} />

      <form className="flex gap-3 mb-5" action="/purchase-orders">
        <select
          name="status"
          defaultValue={sp.status ?? ''}
          className="bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
        >
          <option value="">Any status</option>
          <option value="draft">Draft</option>
          <option value="pending_review">Pending review</option>
          <option value="sent">Sent</option>
          <option value="partially_received">Partially received</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          name="department"
          defaultValue={sp.department ?? ''}
          className="bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
        >
          <option value="">All departments</option>
          <option value="plumbing">Plumbing</option>
          <option value="hvac">HVAC</option>
          <option value="office">Office</option>
        </select>
        <button
          type="submit"
          className="bg-christmas-green hover:bg-christmas-green-light text-white text-sm rounded px-4 py-2 transition"
        >
          Filter
        </button>
      </form>

      <Table>
        <THead>
          <tr>
            <Th>PO #</Th>
            <Th>Supplier</Th>
            <Th>Warehouse</Th>
            <Th>Department</Th>
            <Th align="right">Lines</Th>
            <Th align="right">Total</Th>
            <Th>Created</Th>
            <Th>Status</Th>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={8}>
                <EmptyState message="No purchase orders match the filter." />
              </td>
            </tr>
          )}
          {rows.map((po) => {
            const r = po as Record<string, unknown>;
            return (
              <tr key={r.id as string} className="hover:bg-bg-card-hover transition">
                <Td>
                  <Link href={`/purchase-orders/${r.id as string}`} className="text-text-primary hover:text-christmas-green-light font-medium">
                    {r.po_number as string}
                  </Link>
                </Td>
                <Td muted>{(r.supply_house_name as string) ?? '—'}</Td>
                <Td muted>{(r.warehouse_name as string) ?? '—'}</Td>
                <Td muted>{titleCase(r.department as string)}</Td>
                <Td align="right">{r.line_count as string}</Td>
                <Td align="right">{formatMoney(r.total as number | string)}</Td>
                <Td muted>{formatDate(r.created_at as string)}</Td>
                <Td>
                  <StatusBadge status={r.status as string} />
                </Td>
              </tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
