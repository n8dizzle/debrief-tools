import Link from 'next/link';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { PageHeader, Card, DataRow, Table, THead, TBody, Th, Td, EmptyState, StatusBadge } from '@/components/ui';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';

interface TransferDetail {
  id: string;
  transfer_type: string | null;
  status: string | null;
  number: string | null;
  reference_number: string | null;
  from_location_id: string | null;
  to_location_id: string | null;
  created_by_id: string | null;
  picked_by_id: string | null;
  received_by_id: string | null;
  memo: string | null;
  job_id: string | null;
  invoice_id: string | null;
  transfer_date: string | null;
  picked_date: string | null;
  received_date: string | null;
  st_created_on: string | null;
  st_modified_on: string | null;
  synced_at: string;
}

interface TransferItem {
  id: string;
  sku_id: string | null;
  name: string | null;
  code: string | null;
  description: string | null;
  quantity: string | null;
  quantity_picked: string | null;
  cost: string | null;
  total_cost: string | null;
  active: boolean;
  material_id: string | null;
  material_name: string | null;
}

async function getTransfer(id: string) {
  const { rows } = await query<TransferDetail>(
    `SELECT * FROM st_inventory_transfers WHERE id = $1`,
    [id],
  );
  if (!rows[0]) return null;

  const { rows: items } = await query<TransferItem>(
    `SELECT i.*,
            m.id   AS material_id,
            m.name AS material_name
       FROM st_inventory_transfer_items i
       LEFT JOIN materials m ON m.st_pricebook_id = i.sku_id::text
      WHERE i.transfer_id = $1
      ORDER BY i.id`,
    [id],
  );

  return { transfer: rows[0], items };
}

export default async function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getTransfer(id);
  if (!data) notFound();

  const { transfer: t, items } = data;
  const totalValue = items.reduce((s, i) => s + Number(i.total_cost ?? 0), 0);
  const totalQty = items.reduce((s, i) => s + Number(i.quantity ?? 0), 0);

  return (
    <div className="px-8 py-6">
      <PageHeader
        title={`Transfer #${t.number ?? t.id}`}
        description={`${t.transfer_type ?? 'Transfer'} · ST id ${t.id}`}
        back={{ href: '/transfers', label: 'Back to transfers' }}
        actions={<StatusBadge status={t.status} />}
      />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card title="Transfer details">
          <dl className="text-sm">
            <DataRow label="Number" value={t.number ?? '—'} />
            <DataRow label="Reference" value={t.reference_number ?? '—'} />
            <DataRow label="Type" value={t.transfer_type ?? '—'} />
            <DataRow label="Status" value={t.status ?? '—'} />
            <DataRow label="Date" value={formatDateTime(t.transfer_date)} />
            <DataRow label="Picked" value={formatDateTime(t.picked_date)} />
            <DataRow label="Received" value={formatDateTime(t.received_date)} />
            {t.memo && <DataRow label="Memo" value={t.memo} />}
          </dl>
        </Card>

        <Card title="Routing &amp; references">
          <dl className="text-sm">
            <DataRow label="From location" value={t.from_location_id ?? '—'} />
            <DataRow label="To location" value={t.to_location_id ?? '—'} />
            {t.job_id && <DataRow label="Job ID" value={t.job_id} />}
            {t.invoice_id && <DataRow label="Invoice ID" value={t.invoice_id} />}
            <DataRow label="ST created" value={formatDateTime(t.st_created_on)} />
            <DataRow label="ST modified" value={formatDateTime(t.st_modified_on)} />
            <DataRow label="Synced at" value={formatDateTime(t.synced_at)} />
          </dl>
        </Card>
      </section>

      <section className="grid grid-cols-3 gap-4 mb-6">
        <Card title="Line items">
          <p className="text-3xl font-semibold text-text-primary">{items.length}</p>
        </Card>
        <Card title="Total units">
          <p className="text-3xl font-semibold text-text-primary">{formatNumber(totalQty)}</p>
        </Card>
        <Card title="Total value">
          <p className="text-3xl font-semibold text-text-primary">{formatMoney(totalValue)}</p>
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-medium text-text-primary mb-3">Line Items</h2>
        <Table>
          <THead>
            <tr>
              <Th>Code</Th>
              <Th>Material</Th>
              <Th align="right">Qty</Th>
              <Th align="right">Picked</Th>
              <Th align="right">Unit cost</Th>
              <Th align="right">Total</Th>
              <Th>Linked</Th>
            </tr>
          </THead>
          <TBody>
            {items.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState message="No line items on this transfer." />
                </td>
              </tr>
            )}
            {items.map((i) => (
              <tr key={i.id} className="hover:bg-bg-card-hover transition">
                <Td mono muted>{i.code ?? i.sku_id ?? '—'}</Td>
                <Td>
                  {i.material_id ? (
                    <Link href={`/materials/${i.material_id}`} className="text-text-primary hover:text-christmas-green-light">
                      {i.material_name ?? i.name ?? '—'}
                    </Link>
                  ) : (
                    <span className="text-text-muted italic">{i.name ?? `sku ${i.sku_id ?? '?'}`}</span>
                  )}
                </Td>
                <Td align="right">{formatNumber(Number(i.quantity ?? 0))}</Td>
                <Td align="right">{formatNumber(Number(i.quantity_picked ?? 0))}</Td>
                <Td align="right">{formatMoney(i.cost ?? null)}</Td>
                <Td align="right">{formatMoney(i.total_cost ?? null)}</Td>
                <Td muted>
                  {i.material_id ? (
                    <span className="text-christmas-green-light text-xs">Yes</span>
                  ) : (
                    <span className="text-yellow-300 text-xs">No</span>
                  )}
                </Td>
              </tr>
            ))}
          </TBody>
        </Table>
      </section>
    </div>
  );
}
