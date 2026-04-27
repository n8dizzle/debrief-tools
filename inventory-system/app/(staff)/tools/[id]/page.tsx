import { notFound } from 'next/navigation';
import { AppError } from '@/lib/errors';
import { getTool } from '@/lib/services/tools';
import { PageHeader, Card, DataRow, Table, THead, TBody, Th, Td, EmptyState, StatusBadge } from '@/components/ui';
import { titleCase, formatDateTime, formatDate, formatMoney } from '@/lib/format';

export default async function ToolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let detail;
  try {
    detail = await getTool(id);
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) notFound();
    throw e;
  }

  const tool = detail.tool as Record<string, unknown>;

  return (
    <div className="px-8 py-6">
      <PageHeader
        title={tool.name as string}
        description={`${tool.manufacturer as string} ${tool.model as string} · SN ${tool.serial_number as string}`}
        back={{ href: '/tools', label: 'Back to tools' }}
        actions={<StatusBadge status={tool.status as string} />}
      />

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title="Details">
          <dl className="text-sm">
            <DataRow label="Department" value={titleCase(tool.department as string)} />
            <DataRow label="Category" value={(tool.category as string) ?? '—'} />
            <DataRow label="Home" value={(tool.home_warehouse_name as string) ?? '—'} />
            <DataRow label="Condition" value={titleCase((tool.current_condition as string) ?? '—')} />
            <DataRow label="Barcode" value={(tool.barcode as string) ?? '—'} />
          </dl>
        </Card>

        <Card title="Purchase">
          <dl className="text-sm">
            <DataRow label="Purchased" value={formatDate(tool.purchase_date as string | null)} />
            <DataRow label="Cost" value={formatMoney(tool.purchase_cost as number | string | null)} />
            <DataRow label="Warranty until" value={formatDate(tool.warranty_expiry as string | null)} />
          </dl>
        </Card>

        <Card title="Current checkout">
          <dl className="text-sm">
            <DataRow label="Checked out to" value={(tool.checked_out_to_name as string) ?? '—'} />
            <DataRow label="On truck" value={(tool.checked_out_truck_number as string) ?? '—'} />
            <DataRow label="Job" value={(tool.checked_out_job as string) ?? '—'} />
            <DataRow label="Since" value={formatDateTime(tool.checked_out_at as string | null)} />
          </dl>
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-medium text-text-primary mb-3">History</h2>
        <Table>
          <THead>
            <tr>
              <Th>When</Th>
              <Th>Action</Th>
              <Th>Performed by</Th>
              <Th>Technician</Th>
              <Th>Truck</Th>
              <Th>Condition</Th>
              <Th>Notes</Th>
            </tr>
          </THead>
          <TBody>
            {detail.history.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState message="No movement history recorded." />
                </td>
              </tr>
            )}
            {detail.history.map((row) => {
              const h = row as Record<string, unknown>;
              return (
                <tr key={h.id as string} className="hover:bg-bg-card-hover transition">
                  <Td muted>{formatDateTime(h.created_at as string)}</Td>
                  <Td>{titleCase((h.movement_type as string) ?? '')}</Td>
                  <Td muted>{(h.performed_by_name as string) ?? '—'}</Td>
                  <Td muted>{(h.technician_name as string) ?? '—'}</Td>
                  <Td muted>{(h.truck_number as string) ?? '—'}</Td>
                  <Td muted>{titleCase((h.condition_at_time as string) ?? '—')}</Td>
                  <Td muted>{(h.notes as string) ?? '—'}</Td>
                </tr>
              );
            })}
          </TBody>
        </Table>
      </section>
    </div>
  );
}
