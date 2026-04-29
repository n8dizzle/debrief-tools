import { notFound } from 'next/navigation';
import { AppError } from '@/lib/errors';
import { getTruck, getTruckStock } from '@/lib/services/trucks';
import { listUsers } from '@/lib/services/users';
import { query } from '@/lib/db';
import { PageHeader, Card, DataRow, Table, THead, TBody, Th, Td, EmptyState, StatusBadge } from '@/components/ui';
import { titleCase, formatNumber } from '@/lib/format';
import TruckHeaderActions from './TruckHeaderActions';
import TechAssignmentCard from './TechAssignmentCard';
import ApplyTemplateButton from './ApplyTemplateButton';
import MinMaxForm from '@/components/MinMaxForm';
import { updateTruckStockMinMax } from '../actions';

export default async function TruckDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let truck;
  try {
    truck = await getTruck(id);
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) notFound();
    throw e;
  }

  const truckAny = truck as unknown as Record<string, unknown>;
  const templateId = truckAny.template_id as string | null;

  // Resolve template name if assigned
  let templateName: string | null = null;
  if (templateId) {
    const { rows: tplRows } = await query<{ name: string }>(
      `SELECT name FROM inventory_templates WHERE id = $1`,
      [templateId],
    );
    templateName = tplRows[0]?.name ?? null;
  }

  const [stock, allTechs] = await Promise.all([
    getTruckStock(id),
    listUsers({ role: 'technician', isActive: true }).catch(() => []),
  ]);

  const totalLines = stock.length;
  const totalQty = stock.reduce(
    (s, r) => s + Number((r as { quantity_on_hand: number | string }).quantity_on_hand || 0),
    0,
  );

  const assigned = (truck.assigned_users ?? []).map((u) => ({ id: u.id, name: u.name, role: u.role }));
  const assignedIds = new Set(assigned.map((u) => u.id));
  const candidates = allTechs
    .filter((t) => !assignedIds.has(t.id))
    .map((t) => ({ id: t.id, name: `${t.first_name} ${t.last_name}`.trim(), email: t.email }));

  return (
    <div className="px-8 py-6">
      <PageHeader
        title={truck.truck_number}
        description={`${titleCase(truck.department)} · ${truck.warehouse_name}`}
        back={{ href: '/trucks', label: 'Back to trucks' }}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={truck.status} />
            <TruckHeaderActions truckId={id} status={truck.status} />
          </div>
        }
      />

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title="Vehicle">
          <dl className="text-sm">
            <DataRow label="Make" value={truck.make ?? '—'} />
            <DataRow label="Model" value={truck.model ?? '—'} />
            <DataRow label="Year" value={truck.year ?? '—'} />
            <DataRow label="License" value={truck.license_plate ?? '—'} />
            <DataRow
              label="VIN"
              value={(truck as unknown as { vin: string | null }).vin ?? '—'}
            />
          </dl>
        </Card>

        <TechAssignmentCard truckId={id} assigned={assigned} candidates={candidates} />

        <Card title="Stock summary">
          <dl className="text-sm">
            <DataRow label="Department" value={titleCase(truck.department)} />
            <DataRow label="Home" value={truck.warehouse_name} />
            <DataRow label="Line items" value={formatNumber(totalLines)} />
            <DataRow label="Total qty" value={formatNumber(totalQty)} />
            <DataRow label="Template" value={templateName ?? '—'} />
          </dl>
          {templateId && (
            <div className="mt-4">
              <ApplyTemplateButton truckId={id} />
            </div>
          )}
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-medium text-text-primary mb-3">On-truck stock</h2>
        <Table>
          <THead>
            <tr>
              <Th>SKU</Th>
              <Th>Material</Th>
              <Th>Category</Th>
              <Th align="right">Qty on hand</Th>
              <Th>UoM</Th>
              <Th align="right">Reorder pt.</Th>
              <Th>Min / Max</Th>
            </tr>
          </THead>
          <TBody>
            {stock.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState message="This truck has no recorded stock yet." />
                </td>
              </tr>
            )}
            {stock.map((s, i) => {
              const r = s as Record<string, unknown>;
              const stockId = r.id as string;
              return (
                <tr key={`${r.material_id}-${i}`} className="hover:bg-bg-card-hover transition">
                  <Td mono muted>{r.sku as string}</Td>
                  <Td>{r.name as string}</Td>
                  <Td muted>{(r.category as string) ?? '—'}</Td>
                  <Td align="right">{formatNumber(r.quantity_on_hand as number | string)}</Td>
                  <Td muted>{(r.unit_of_measure as string) ?? '—'}</Td>
                  <Td align="right" muted>{formatNumber(r.reorder_point as number | string)}</Td>
                  <Td>
                    <MinMaxForm
                      action={updateTruckStockMinMax.bind(null, stockId)}
                      minQty={Number(r.min_quantity ?? 0)}
                      maxQty={r.max_quantity != null ? Number(r.max_quantity) : null}
                    />
                  </Td>
                </tr>
              );
            })}
          </TBody>
        </Table>
      </section>
    </div>
  );
}
