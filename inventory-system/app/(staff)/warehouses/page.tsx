import Link from 'next/link';
import { listWarehouses } from '@/lib/services/warehouses';
import { PageHeader, Table, THead, TBody, Th, Td, EmptyState, StatusBadge } from '@/components/ui';

export default async function WarehousesPage() {
  const rows = await listWarehouses();

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="Warehouses"
        description={`${rows.length} warehouse${rows.length === 1 ? '' : 's'}`}
      />

      <Table>
        <THead>
          <tr>
            <Th>Name</Th>
            <Th>Department</Th>
            <Th>City</Th>
            <Th align="right">Active trucks</Th>
            <Th>Status</Th>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5}>
                <EmptyState message="No warehouses configured." />
              </td>
            </tr>
          )}
          {rows.map((w) => {
            const wRow = w as unknown as Record<string, unknown>;
            return (
              <tr key={w.id} className="hover:bg-bg-card-hover transition">
                <Td>
                  <Link href={`/warehouses/${w.id}`} className="text-text-primary hover:text-christmas-green-light font-medium">
                    {w.name}
                  </Link>
                </Td>
                <Td muted className="capitalize">
                  {(wRow.department as string) ?? '—'}
                </Td>
                <Td muted>
                  {[wRow.city as string | undefined, wRow.state as string | undefined].filter(Boolean).join(', ') || '—'}
                </Td>
                <Td align="right">{w.active_truck_count}</Td>
                <Td>
                  <StatusBadge status={w.status} />
                </Td>
              </tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
