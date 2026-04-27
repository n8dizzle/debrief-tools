import Link from 'next/link';
import { listBatches } from '@/lib/services/restock-batches';
import { PageHeader, Table, THead, TBody, Th, Td, EmptyState, StatusBadge } from '@/components/ui';
import { formatDateTime } from '@/lib/format';

export default async function RestockBatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const rows = await listBatches({ status: sp.status || null });

  return (
    <div className="px-8 py-6">
      <PageHeader title="Restock Batches" description={`${rows.length} batch${rows.length === 1 ? '' : 'es'}`} />

      <form className="flex gap-3 mb-5" action="/restock-batches">
        <select
          name="status"
          defaultValue={sp.status ?? ''}
          className="bg-bg-secondary border border-border-default rounded px-3 py-2 text-sm outline-none focus:border-christmas-green"
        >
          <option value="">Any status</option>
          <option value="collecting">Collecting</option>
          <option value="locked">Locked</option>
          <option value="approved">Approved</option>
          <option value="picked">Picked</option>
          <option value="completed">Completed</option>
          <option value="partially_completed">Partially completed</option>
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
            <Th>Batch #</Th>
            <Th>Truck</Th>
            <Th>Warehouse</Th>
            <Th align="right">Lines</Th>
            <Th align="right">Approved</Th>
            <Th align="right">Pending</Th>
            <Th>Created</Th>
            <Th>Status</Th>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={8}>
                <EmptyState message="No restock batches yet." />
              </td>
            </tr>
          )}
          {rows.map((b) => {
            const r = b as Record<string, unknown>;
            return (
              <tr key={r.id as string} className="hover:bg-bg-card-hover transition">
                <Td>
                  <Link href={`/restock-batches/${r.id as string}`} className="text-text-primary hover:text-christmas-green-light font-medium">
                    {(r.batch_number as string) ?? (r.id as string).slice(0, 8)}
                  </Link>
                </Td>
                <Td muted>{(r.truck_number as string) ?? '—'}</Td>
                <Td muted>{(r.warehouse_name as string) ?? '—'}</Td>
                <Td align="right">{r.line_count as string}</Td>
                <Td align="right">{r.approved_count as string}</Td>
                <Td align="right">{r.pending_count as string}</Td>
                <Td muted>{formatDateTime(r.created_at as string)}</Td>
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
