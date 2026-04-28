import Link from 'next/link';
import { query } from '@/lib/db';
import { PageHeader, Card, Table, THead, TBody, Th, Td, EmptyState, StatusBadge } from '@/components/ui';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';

interface TransferRow {
  id: string;
  transfer_type: string | null;
  status: string | null;
  number: string | null;
  from_location_id: string | null;
  to_location_id: string | null;
  transfer_date: string | null;
  received_date: string | null;
  synced_at: string;
  item_count: string;
  total_value: string | null;
}

async function listTransfers(): Promise<TransferRow[]> {
  try {
    const { rows } = await query<TransferRow>(
      `SELECT t.id, t.transfer_type, t.status, t.number,
              t.from_location_id, t.to_location_id,
              t.transfer_date, t.received_date, t.synced_at,
              COUNT(i.id)::text         AS item_count,
              SUM(i.total_cost)::text   AS total_value
         FROM st_inventory_transfers t
         LEFT JOIN st_inventory_transfer_items i ON i.transfer_id = t.id
        WHERE t.active = TRUE
        GROUP BY t.id
        ORDER BY t.transfer_date DESC NULLS LAST, t.id DESC
        LIMIT 200`,
    );
    return rows;
  } catch {
    return [];
  }
}

async function getStats(): Promise<{ total: number; received: number; pending: number; lastSynced: string | null }> {
  try {
    const { rows } = await query<{ status: string | null; cnt: string }>(
      `SELECT status, COUNT(*)::text AS cnt FROM st_inventory_transfers WHERE active = TRUE GROUP BY status`,
    );
    const map = new Map(rows.map((r) => [r.status ?? 'null', Number(r.cnt)]));
    const total = rows.reduce((s, r) => s + Number(r.cnt), 0);
    const { rows: ts } = await query<{ synced_at: string }>(
      `SELECT synced_at FROM st_inventory_transfers ORDER BY synced_at DESC LIMIT 1`,
    );
    return {
      total,
      received: map.get('Received') ?? 0,
      pending: (map.get('Pending') ?? 0) + (map.get('Draft') ?? 0),
      lastSynced: ts[0]?.synced_at ?? null,
    };
  } catch {
    return { total: 0, received: 0, pending: 0, lastSynced: null };
  }
}

export default async function TransfersPage() {
  const [transfers, stats] = await Promise.all([listTransfers(), getStats()]);

  const isEmpty = stats.total === 0;

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="Inventory Transfers"
        description={
          stats.lastSynced
            ? `Last synced ${formatDateTime(stats.lastSynced)} · ${stats.total} transfers`
            : 'Not yet synced from ServiceTitan'
        }
      />

      {isEmpty ? (
        <Card>
          <EmptyState message="No transfers synced yet. Run a ServiceTitan sync from the Settings page to pull transfers." />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card title="Total transfers">
              <p className="text-3xl font-semibold text-text-primary">{formatNumber(stats.total)}</p>
            </Card>
            <Card title="Received">
              <p className="text-3xl font-semibold text-christmas-green">{formatNumber(stats.received)}</p>
            </Card>
            <Card title="Pending / Draft">
              <p className="text-3xl font-semibold text-yellow-400">{formatNumber(stats.pending)}</p>
            </Card>
          </div>

          <Table>
            <THead>
              <tr>
                <Th>#</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>From → To</Th>
                <Th>Date</Th>
                <Th align="right">Items</Th>
                <Th align="right">Value</Th>
              </tr>
            </THead>
            <TBody>
              {transfers.map((t) => (
                <tr key={t.id} className="hover:bg-bg-card-hover transition">
                  <Td mono>
                    <Link href={`/transfers/${t.id}`} className="text-text-primary hover:text-christmas-green-light">
                      {t.number ?? t.id}
                    </Link>
                  </Td>
                  <Td muted>{t.transfer_type ?? '—'}</Td>
                  <Td>
                    <StatusBadge status={t.status} />
                  </Td>
                  <Td muted>
                    <span className="font-mono text-xs">
                      {t.from_location_id ?? '?'} → {t.to_location_id ?? '?'}
                    </span>
                  </Td>
                  <Td muted>{formatDateTime(t.transfer_date)}</Td>
                  <Td align="right">{formatNumber(Number(t.item_count))}</Td>
                  <Td align="right">{t.total_value ? formatMoney(Number(t.total_value)) : '—'}</Td>
                </tr>
              ))}
            </TBody>
          </Table>
        </>
      )}
    </div>
  );
}
