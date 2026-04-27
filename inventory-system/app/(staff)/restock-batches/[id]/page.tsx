import { notFound } from 'next/navigation';
import { AppError } from '@/lib/errors';
import { getBatch } from '@/lib/services/restock-batches';
import { PageHeader, Card, DataRow, Table, THead, TBody, Th, Td, EmptyState, StatusBadge } from '@/components/ui';
import { formatDateTime, formatMoney, titleCase } from '@/lib/format';

export default async function RestockBatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let detail;
  try {
    detail = await getBatch(id);
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) notFound();
    throw e;
  }

  const b = detail.batch as Record<string, unknown>;
  const lines = detail.lines;

  return (
    <div className="px-8 py-6">
      <PageHeader
        title={(b.batch_number as string) ?? `Batch ${(b.id as string).slice(0, 8)}`}
        description={`${b.truck_number as string} · ${b.warehouse_name as string}`}
        back={{ href: '/restock-batches', label: 'Back to batches' }}
        actions={<StatusBadge status={b.status as string} />}
      />

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title="Workflow">
          <dl className="text-sm">
            <DataRow label="Status" value={titleCase(b.status as string)} />
            <DataRow label="Created" value={formatDateTime(b.created_at as string)} />
            <DataRow label="Locked" value={formatDateTime(b.locked_at as string | null)} />
            <DataRow label="Approved" value={formatDateTime(b.approved_at as string | null)} />
            <DataRow label="Picked" value={formatDateTime(b.picked_at as string | null)} />
            <DataRow label="Completed" value={formatDateTime(b.completed_at as string | null)} />
          </dl>
        </Card>

        <Card title="Truck">
          <dl className="text-sm">
            <DataRow label="Truck #" value={(b.truck_number as string) ?? '—'} />
            <DataRow label="Warehouse" value={(b.warehouse_name as string) ?? '—'} />
          </dl>
        </Card>

        <Card title="Counts">
          <dl className="text-sm">
            <DataRow label="Total lines" value={String(lines.length)} />
            <DataRow label="Lock trigger" value={titleCase((b.lock_trigger as string) ?? '—')} />
          </dl>
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-medium text-text-primary mb-3">Lines</h2>
        <Table>
          <THead>
            <tr>
              <Th>SKU</Th>
              <Th>Material</Th>
              <Th>Job</Th>
              <Th align="right">Requested</Th>
              <Th align="right">Approved</Th>
              <Th align="right">Cost</Th>
              <Th>Line status</Th>
              <Th>Denial reason</Th>
            </tr>
          </THead>
          <TBody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState message="No restock lines yet." />
                </td>
              </tr>
            )}
            {lines.map((row) => {
              const l = row as Record<string, unknown>;
              return (
                <tr key={l.id as string} className="hover:bg-bg-card-hover transition">
                  <Td mono muted>{(l.sku as string) ?? '—'}</Td>
                  <Td>{l.material_name as string}</Td>
                  <Td mono muted>{(l.st_job_id as string) ?? '—'}</Td>
                  <Td align="right">{l.quantity_requested as number}</Td>
                  <Td align="right">{(l.quantity_approved as number | null) ?? '—'}</Td>
                  <Td align="right">{formatMoney(l.unit_cost as number | string)}</Td>
                  <Td>
                    <StatusBadge status={l.status as string} />
                  </Td>
                  <Td muted>{(l.denial_reason as string) ?? '—'}</Td>
                </tr>
              );
            })}
          </TBody>
        </Table>
      </section>
    </div>
  );
}
