import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppError } from '@/lib/errors';
import { getWarehouse } from '@/lib/services/warehouses';
import { getWarehouseStock } from '@/lib/services/material-movements';
import { PageHeader, Card, DataRow, Table, THead, TBody, Th, Td, EmptyState, StatusBadge } from '@/components/ui';
import { titleCase, formatNumber, formatMoney } from '@/lib/format';

export default async function WarehouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let wh;
  try {
    wh = await getWarehouse(id);
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) notFound();
    throw e;
  }

  const stock = await getWarehouseStock(id);
  const totalValue = stock.reduce((s, r) => {
    const v = (r as { stock_value: number | string | null }).stock_value;
    return s + (typeof v === 'string' ? parseFloat(v) : Number(v ?? 0));
  }, 0);

  const w = wh as unknown as Record<string, unknown>;

  return (
    <div className="px-8 py-6">
      <PageHeader
        title={wh.name}
        description={titleCase((w.department as string) ?? '')}
        back={{ href: '/warehouses', label: 'Back to warehouses' }}
        actions={<StatusBadge status={wh.status} />}
      />

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title="Address">
          <dl className="text-sm">
            <DataRow label="Street" value={(w.address as string) ?? '—'} />
            <DataRow label="City" value={(w.city as string) ?? '—'} />
            <DataRow label="State" value={(w.state as string) ?? '—'} />
            <DataRow label="ZIP" value={(w.zip as string) ?? '—'} />
          </dl>
        </Card>

        <Card title="Stock summary">
          <dl className="text-sm">
            <DataRow label="Distinct items" value={formatNumber(stock.length)} />
            <DataRow label="Total value" value={formatMoney(totalValue)} />
          </dl>
        </Card>

        <Card title="Trucks">
          {wh.trucks?.length ? (
            <ul className="text-sm space-y-1.5">
              {wh.trucks.map((t) => {
                const tt = t as Record<string, unknown>;
                return (
                  <li key={tt.id as string}>
                    <Link href={`/trucks/${tt.id}`} className="text-text-primary hover:text-christmas-green-light">
                      {tt.truck_number as string}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No trucks home-based here.</p>
          )}
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-medium text-text-primary mb-3">Warehouse stock</h2>
        <Table>
          <THead>
            <tr>
              <Th>SKU</Th>
              <Th>Material</Th>
              <Th>Category</Th>
              <Th>Location</Th>
              <Th align="right">On hand</Th>
              <Th align="right">Reorder</Th>
              <Th align="right">Stock value</Th>
            </tr>
          </THead>
          <TBody>
            {stock.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState message="No stock recorded at this warehouse yet." />
                </td>
              </tr>
            )}
            {stock.map((row, i) => {
              const r = row as Record<string, unknown>;
              return (
                <tr key={`${r.material_id as string}-${i}`} className="hover:bg-bg-card-hover transition">
                  <Td mono muted>{r.sku as string}</Td>
                  <Td>{r.name as string}</Td>
                  <Td muted>{(r.category as string) ?? '—'}</Td>
                  <Td muted>{(r.location_label as string) ?? '—'}</Td>
                  <Td align="right">{formatNumber(r.quantity_on_hand as number | string)}</Td>
                  <Td align="right" muted>{formatNumber(r.reorder_point as number | string)}</Td>
                  <Td align="right">{formatMoney(r.stock_value as number | string)}</Td>
                </tr>
              );
            })}
          </TBody>
        </Table>
      </section>
    </div>
  );
}
