import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppError } from '@/lib/errors';
import { getInventoryTemplate } from '@/lib/services/inventory-templates';
import { PageHeader, Card, DataRow, Table, THead, TBody, Th, Td, EmptyState, StatusBadge } from '@/components/ui';
import { formatDateTime, formatNumber, formatMoney } from '@/lib/format';

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let detail;
  try {
    detail = await getInventoryTemplate(id);
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) notFound();
    throw e;
  }

  const { template, items, warehouses } = detail;
  const totalUnits = items.reduce((s, i) => s + Number(i.target_quantity || 0), 0);
  const totalValue = items.reduce((s, i) => {
    const cost = Number(i.material_cost ?? 0);
    return s + cost * Number(i.target_quantity || 0);
  }, 0);

  return (
    <div className="px-8 py-6">
      <PageHeader
        title={template.name}
        description={template.description ?? (template.st_template_id ? `ServiceTitan template · ${template.st_template_id}` : 'Local template')}
        back={{ href: '/templates', label: 'Back to templates' }}
        actions={<StatusBadge status={template.is_active ? 'active' : 'inactive'} />}
      />

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title="Summary">
          <dl className="text-sm">
            <DataRow label="Items" value={String(items.length)} />
            <DataRow label="Total target units" value={formatNumber(totalUnits)} />
            <DataRow label="Total target value" value={formatMoney(totalValue)} />
          </dl>
        </Card>

        <Card title="Source">
          <dl className="text-sm">
            <DataRow label="Source" value={template.st_template_id ? 'ServiceTitan' : 'Local'} />
            <DataRow label="ST id" value={template.st_template_id ?? '—'} />
            <DataRow label="Last sync" value={formatDateTime(template.st_last_synced)} />
            <DataRow label="Created" value={formatDateTime(template.created_at)} />
          </dl>
        </Card>

        <Card title="Linked warehouses">
          {warehouses.length === 0 ? (
            <p className="text-sm text-text-muted">
              {template.st_template_id
                ? 'No warehouse currently references this template.'
                : 'Local template — link a warehouse via the API or DB.'}
            </p>
          ) : (
            <ul className="text-sm space-y-1.5">
              {warehouses.map((w) => (
                <li key={w.id}>
                  <Link href={`/warehouses/${w.id}`} className="text-text-primary hover:text-christmas-green-light">
                    {w.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-medium text-text-primary mb-3">Items</h2>
        <Table>
          <THead>
            <tr>
              <Th>SKU</Th>
              <Th>Material</Th>
              <Th>UoM</Th>
              <Th align="right">Target qty</Th>
              <Th align="right">Unit cost</Th>
              <Th align="right">Target value</Th>
              <Th>Linked</Th>
            </tr>
          </THead>
          <TBody>
            {items.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState message="No items in this template yet." />
                </td>
              </tr>
            )}
            {items.map((i) => {
              const cost = Number(i.material_cost ?? 0);
              const qty = Number(i.target_quantity || 0);
              return (
                <tr key={i.id} className="hover:bg-bg-card-hover transition">
                  <Td mono muted>{i.material_sku ?? i.st_sku_id ?? '—'}</Td>
                  <Td>
                    {i.material_id ? (
                      <Link href={`/materials/${i.material_id}`} className="text-text-primary hover:text-christmas-green-light">
                        {i.material_name ?? '—'}
                      </Link>
                    ) : (
                      <span className="text-text-muted italic">unmatched (ST sku {i.st_sku_id})</span>
                    )}
                  </Td>
                  <Td muted>{i.material_uom ?? '—'}</Td>
                  <Td align="right">{formatNumber(qty)}</Td>
                  <Td align="right">{formatMoney(i.material_cost ?? null)}</Td>
                  <Td align="right">{formatMoney(cost * qty)}</Td>
                  <Td muted>{i.material_id ? 'Yes' : <span className="text-yellow-300">No</span>}</Td>
                </tr>
              );
            })}
          </TBody>
        </Table>
      </section>
    </div>
  );
}
